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
        tokenVersion: true,
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

  // --- Refresh sessions ---

  async createRefreshSession(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    device?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }) {
    return prisma.refreshSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        device: data.device,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshSessionByTokenHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshSession(tokenHash: string, reason: string) {
    return prisma.refreshSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason as any,
      },
    });
  }

  async revokeRefreshSessionFamily(familyId: string, reason: string, excludeTokenHash?: string) {
    return prisma.refreshSession.updateMany({
      where: {
        familyId,
        revokedAt: null,
        ...(excludeTokenHash ? { tokenHash: { not: excludeTokenHash } } : {}),
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason as any,
      },
    });
  }

  async revokeAllUserRefreshSessions(userId: string, reason: string) {
    return prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason as any,
      },
    });
  }

  async revokeRefreshSessionById(id: string, userId: string, reason: string) {
    return prisma.refreshSession.updateMany({
      where: {
        id,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason as any,
      },
    });
  }

  async expireInactiveRefreshSessions(before: Date) {
    return prisma.refreshSession.updateMany({
      where: {
        expiresAt: { lt: before },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: 'EXPIRED',
      },
    });
  }

  async countActiveRefreshSessions(userId: string) {
    return prisma.refreshSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }
}

export const userRepository = new UserRepository();
