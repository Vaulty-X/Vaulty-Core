import { prisma } from '../database';

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
        tokenVersion: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return prisma.user.findUnique({
      where: { phoneNumber },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }) {
    return prisma.user.create({
      data,
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
        tokenVersion: true,
      },
    });
  }

  async incrementTokenVersion(id: string) {
    return prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
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

  async consumePasswordResetToken(tokenHash: string) {
    const { count } = await prisma.passwordResetToken.updateMany({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });
    if (count === 0) return null;
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
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

  async consumeEmailVerificationToken(tokenHash: string) {
    const { count } = await prisma.emailVerificationToken.updateMany({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });
    if (count === 0) return null;
    return prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
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
      },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
  }
}

export const userRepository = new UserRepository();
