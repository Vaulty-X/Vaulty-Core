import { userRepository } from '../repositories/user.repository';
import { prisma } from '../database';
import { AppError } from '../utils/AppError';
import {
  hashPassword,
  comparePassword,
  generateSecureToken,
  generateTokenExpiry,
  hashToken,
  generateSessionId,
  generateFamilyId,
} from '../utils/crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import { queuePasswordResetEmail, queueVerificationEmail } from '../queues';
import { parseRefreshTokenExpiryMs } from '../config';
import { normalizeEmail, normalizePhoneNumber } from '../utils/identity';
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  ResendVerificationEmailInput,
} from '../validators/auth.validator';

const EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES = 60 * 24;
const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 60;

interface SessionMetadata {
  device?: string;
  ipAddress?: string;
  userAgent?: string;
}

const buildTokenPayload = (user: {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
  jti?: string;
  familyId?: string;
}): TokenPayload => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion,
  ...(user.jti ? { jti: user.jti } : {}),
  ...(user.familyId ? { familyId: user.familyId } : {}),
});

const refreshExpiryFromNow = (): Date => {
  const ms = parseRefreshTokenExpiryMs();
  return new Date(Date.now() + ms);
};

export class AuthService {
  /**
   * Creates a new refresh session for a user and returns the signed JWT pair.
   * `familyId` groups rotated tokens so that reuse of an old token can revoke
   * the entire session family.
   */
  private async issueSession(
    user: { id: string; email: string; role: string; tokenVersion: number },
    metadata: SessionMetadata,
    familyId?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionFamilyId = familyId || generateFamilyId();
    const jti = generateSessionId();

    const tokenPayload = buildTokenPayload({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      jti,
      familyId: sessionFamilyId,
    });

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const tokenHash = hashToken(refreshToken);

    await userRepository.createRefreshSession({
      userId: user.id,
      tokenHash,
      familyId: sessionFamilyId,
      device: metadata.device ?? null,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
      expiresAt: refreshExpiryFromNow(),
    });

    return { accessToken, refreshToken };
  }

  async register(data: RegisterInput) {
    const email = normalizeEmail(data.email);
    const phoneNumber = data.phoneNumber
      ? normalizePhoneNumber(data.phoneNumber) ?? undefined
      : undefined;

    if (data.phoneNumber && !phoneNumber) {
      throw new AppError('Invalid phone number', 400);
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    if (phoneNumber) {
      const existingPhone = await userRepository.findByPhoneNumber(phoneNumber);
      if (existingPhone) {
        throw new AppError('User with this phone number already exists', 409);
      }
    }

    const passwordHash = await hashPassword(data.password);

    const user = await userRepository.create({
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber,
    });

    const verificationToken = generateSecureToken();
    const verificationTokenHash = hashToken(verificationToken);
    const expiresAt = generateTokenExpiry(EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES);
    await userRepository.createEmailVerificationToken(user.id, verificationTokenHash, expiresAt);

    await queueVerificationEmail({
      to: user.email,
      userId: user.id,
      token: verificationToken,
      expiresAt: expiresAt.toISOString(),
    });

    return { user };
  }

  async login(data: LoginInput) {
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    await userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.issueSession(
      { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
      { device: data.device, ipAddress: data.ipAddress, userAgent: data.userAgent }
    );

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(rawRefreshToken: string, metadata: SessionMetadata = {}) {
    try {
      const payload = verifyRefreshToken(rawRefreshToken);

      const user = await userRepository.findById(payload.userId);
      if (!user) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      const tokenHash = hashToken(rawRefreshToken);
      const session = await userRepository.findRefreshSessionByTokenHash(tokenHash);

      if (!session) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      if (session.revokedAt) {
        // A revoked token was replayed. If it was revoked because of reuse, the
        // family is already dead; otherwise treat this as reuse and revoke the
        // whole family as a precaution.
        const familyId = (payload as TokenPayload).familyId || session.familyId;
        await userRepository.revokeRefreshSessionFamily(familyId, 'REUSE_DETECTED', tokenHash);
        await userRepository.revokeRefreshSession(tokenHash, 'REUSE_DETECTED');
        throw new AppError('Refresh token has been revoked due to suspicious activity', 401);
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        await userRepository.revokeRefreshSession(tokenHash, 'EXPIRED');
        throw new AppError('Invalid or expired refresh token', 401);
      }

      if (session.userId !== user.id) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      const familyId = session.familyId;

      // Atomically rotate: revoke the current token, then issue a new one in the
      // same family. Using a transaction keeps the window race-free. If the
      // session was already rotated by another request, fail instead of issuing
      // a second replacement token.
      const newTokens = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.refreshSession.updateMany({
          where: { tokenHash, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: 'LOGOUT' as any },
        });

        if (updateResult.count === 0) {
          throw new AppError('Refresh token has been revoked due to suspicious activity', 401);
        }

        const issued = await this.issueSession(
          { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
          {
            device: metadata.device,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
          familyId
        );
        return issued;
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = generateSecureToken();
    const resetTokenHash = hashToken(resetToken);
    const expiresAt = generateTokenExpiry(PASSWORD_RESET_TOKEN_EXPIRY_MINUTES);
    await userRepository.createPasswordResetToken(user.id, resetTokenHash, expiresAt);

    await queuePasswordResetEmail({
      to: user.email,
      userId: user.id,
      token: resetToken,
      expiresAt: expiresAt.toISOString(),
    });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = hashToken(data.token);
    const token = await userRepository.consumePasswordResetToken(tokenHash);
    if (!token) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await hashPassword(data.password);
    await userRepository.update(token.userId, { passwordHash });
    await userRepository.incrementTokenVersion(token.userId);
    await userRepository.revokeAllUserRefreshSessions(token.userId, 'PASSWORD_RESET');

    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(data: VerifyEmailInput) {
    const tokenHash = hashToken(data.token);
    const token = await userRepository.consumeEmailVerificationToken(tokenHash);
    if (!token) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    await userRepository.update(token.userId, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    return { message: 'Email has been verified successfully' };
  }

  async resendVerificationEmail(data: ResendVerificationEmailInput) {
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    const message = 'If the email exists and is unverified, a verification link has been sent';

    if (!user || user.isEmailVerified) {
      return { message };
    }

    await userRepository.invalidateUnusedEmailVerificationTokens(user.id);

    const verificationToken = generateSecureToken();
    const verificationTokenHash = hashToken(verificationToken);
    const expiresAt = generateTokenExpiry(EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES);

    await userRepository.createEmailVerificationToken(user.id, verificationTokenHash, expiresAt);
    await queueVerificationEmail({
      to: user.email,
      userId: user.id,
      token: verificationToken,
      expiresAt: expiresAt.toISOString(),
    });

    return { message };
  }

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /**
   * Logs out the session identified by the presented refresh token. The token
   * must still be valid (present and unrevoked) so an attacker cannot use the
   * endpoint to destroy a victim's sessions without the raw token.
   */
  async logout(userId: string, rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    try {
      verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);
    const session = await userRepository.findRefreshSessionByTokenHash(tokenHash);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.revokedAt) {
      throw new AppError('Session already ended', 401);
    }

    if (session.userId !== userId) {
      throw new AppError('Session not found', 404);
    }

    const { count } = await userRepository.revokeRefreshSession(tokenHash, 'LOGOUT');
    return { message: 'Logged out successfully', revoked: count };
  }

  async logoutAll(userId: string) {
    const { count } = await userRepository.revokeAllUserRefreshSessions(userId, 'LOGOUT_ALL');
    return { message: 'All sessions logged out successfully', revoked: count };
  }

  async revokeSession(userId: string, sessionId: string) {
    const { count } = await userRepository.revokeRefreshSessionById(sessionId, userId, 'LOGOUT');
    if (count === 0) {
      throw new AppError('Session not found', 404);
    }
    return { message: 'Session revoked successfully' };
  }

  /**
   * Marks refresh sessions that have passed their expiry as expired so the
   * inactive token table stays small and auditable. Safe to run on a schedule.
   */
  async expireInactiveSessions() {
    const before = new Date();
    const { count } = await userRepository.expireInactiveRefreshSessions(before);
    return { message: 'Inactive sessions expired', expired: count };
  }
}

export const authService = new AuthService();
