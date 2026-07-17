import { userRepository } from '../repositories/user.repository';
import { AppError } from '../utils/AppError';
import { hashPassword, comparePassword, generateSecureToken, generateTokenExpiry, hashToken } from '../utils/crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { queuePasswordResetEmail, queueVerificationEmail } from '../queues';
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

export class AuthService {
  async register(data: RegisterInput) {
    const email = normalizeEmail(data.email);
    const phoneNumber = data.phoneNumber
      ? normalizePhoneNumber(data.phoneNumber) ?? undefined
      : undefined;

    if (data.phoneNumber && !phoneNumber) {
      throw new AppError('Invalid phone number', 400);
    }

    // Check if user already exists
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

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await userRepository.create({
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber,
    });

    // Generate email verification token
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

    return {
      user,
    };
  }

  async login(data: LoginInput) {
    // Find user by email
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await userRepository.update(user.id, { lastLoginAt: new Date() });

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Return user without sensitive data
    const { passwordHash, ...userWithoutPassword } = user;

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
        throw new AppError('User not found', 404);
      }

      // Generate new tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    if (!user) {
      // Don't reveal if user exists for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
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
    // Find valid token
    const tokenHash = hashToken(data.token);
    const tokenRecord = await userRepository.findValidPasswordResetToken(tokenHash);
    if (!tokenRecord) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    if (tokenRecord.used) {
      throw new AppError('Reset token has already been used', 400);
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError('Reset token has expired', 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(data.password);

    // Update user password
    await userRepository.update(tokenRecord.userId, { passwordHash });

    // Invalidate token
    await userRepository.invalidatePasswordResetToken(tokenHash);

    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(data: VerifyEmailInput) {
    // Find valid token
    const tokenHash = hashToken(data.token);
    const tokenRecord = await userRepository.findValidEmailVerificationToken(tokenHash);
    if (!tokenRecord) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    if (tokenRecord.used) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError('Verification token has expired', 400);
    }

    // Update user as verified
    await userRepository.update(tokenRecord.userId, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Invalidate token
    await userRepository.invalidateEmailVerificationToken(tokenHash);

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
}

export const authService = new AuthService();
