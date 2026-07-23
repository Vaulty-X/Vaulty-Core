import { Prisma, VaultTransactionStatus, VaultTransactionType } from '@prisma/client';
import { prisma } from '../database';

export class VaultTransactionRepository {
  async create(data: Prisma.VaultTransactionUncheckedCreateInput) {
    return prisma.vaultTransaction.create({ data });
  }

  async findById(id: string) {
    return prisma.vaultTransaction.findUnique({ where: { id } });
  }

  async findByReference(reference: string) {
    return prisma.vaultTransaction.findUnique({ where: { reference } });
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return prisma.vaultTransaction.findUnique({ where: { idempotencyKey } });
  }

  async findByVaultId(
    vaultId: string,
    options?: { skip?: number; take?: number; status?: VaultTransactionStatus; type?: VaultTransactionType }
  ) {
    const where: Prisma.VaultTransactionWhereInput = { vaultId };
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.type) {
      where.type = options.type;
    }

    return prisma.vaultTransaction.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
    });
  }

  async countByVaultId(
    vaultId: string,
    options?: { status?: VaultTransactionStatus; type?: VaultTransactionType }
  ) {
    const where: Prisma.VaultTransactionWhereInput = { vaultId };
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.type) {
      where.type = options.type;
    }

    return prisma.vaultTransaction.count({ where });
  }

  async findByUserId(
    userId: string,
    options?: { skip?: number; take?: number; type?: VaultTransactionType }
  ) {
    const where: Prisma.VaultTransactionWhereInput = { userId };
    if (options?.type) {
      where.type = options.type;
    }

    return prisma.vaultTransaction.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
    });
  }

  async countByUserId(userId: string, options?: { type?: VaultTransactionType }) {
    const where: Prisma.VaultTransactionWhereInput = { userId };
    if (options?.type) {
      where.type = options.type;
    }

    return prisma.vaultTransaction.count({ where });
  }

  async update(
    id: string,
    data: Prisma.VaultTransactionUncheckedUpdateInput
  ) {
    return prisma.vaultTransaction.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async updateStatus(id: string, status: VaultTransactionStatus, extra?: Record<string, any>) {
    return prisma.vaultTransaction.update({
      where: { id },
      data: {
        status,
        ...extra,
        updatedAt: new Date(),
        ...(status === VaultTransactionStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
        ...(status === VaultTransactionStatus.FAILED || status === VaultTransactionStatus.CANCELLED
          ? { failedAt: new Date() }
          : {}),
      },
    });
  }

  async findPending(limit = 50) {
    return prisma.vaultTransaction.findMany({
      where: { status: VaultTransactionStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
      take: limit,
    });
  }
}

export const vaultTransactionRepository = new VaultTransactionRepository();
