import { userRepository } from '../repositories/user.repository';
import { AppError } from '../utils/AppError';
import { hashPassword, comparePassword, generateSecureToken, generateTokenExpiry, hashToken } from '../utils/crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { queuePasswordResetEmail, queueVerificationEmail } from '../queues';
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

export class AuthService {
  async register(data: RegisterInput) {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    if (data.phoneNumber) {
      const existingPhone = await userRepository.findByPhoneNumber(data.phoneNumber);
      if (existingPhone) {
        throw new AppError('User with this phone number already exists', 409);
      }
    }

    const passwordHash = await hashPassword(data.password);

    const user = await userRepository.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
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
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    await userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { passwordHash, ...userWithoutPassword } = user;

    // Asynchronously cleanup expired tokens
    userRepository.cleanupExpiredTokens().catch(console.error);

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await userRepository.findByEmail(data.email);
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
    const user = await userRepository.findByEmail(data.email);
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
}

export const authService = new AuthService();
