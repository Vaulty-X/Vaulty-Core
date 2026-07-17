import { prisma } from '../database';
import { normalizeEmail, normalizePhoneNumber } from '../utils/identity';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber) ?? phoneNumber;
    return prisma.user.findUnique({
      where: { phoneNumber: normalized },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }) {
    const phoneNumber = data.phoneNumber
      ? normalizePhoneNumber(data.phoneNumber) ?? data.phoneNumber
      : undefined;

    return prisma.user.create({
      data: {
        ...data,
        email: normalizeEmail(data.email),
        phoneNumber,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        isEmailVerified: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, data: Partial<{
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    isEmailVerified: boolean;
    emailVerifiedAt: Date;
    lastLoginAt: Date;
  }>) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async invalidatePasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { used: true },
    });
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async invalidateEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.update({
      where: { tokenHash },
      data: { used: true },
    });
  }

  async invalidateUnusedEmailVerificationTokens(userId: string) {
    return prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        used: false,
      },
      data: { used: true },
    });
  }

  async cleanupExpiredTokens() {
    const now = new Date();
    await prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: now },
        used: true,
      },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: { lt: now },
        used: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
