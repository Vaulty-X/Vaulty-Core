import { Prisma, StellarSubmissionStatus } from '@prisma/client';
import { prisma } from '../database';

export class VaultEventRepository {
  async create(data: Prisma.VaultEventUncheckedCreateInput) {
    return prisma.vaultEvent.create({ data });
  }

  async findById(id: string) {
    return prisma.vaultEvent.findUnique({ where: { id } });
  }

  async findByVaultId(vaultId: string, options?: { skip?: number; take?: number; status?: StellarSubmissionStatus }) {
    const where: Prisma.VaultEventWhereInput = { vaultId };
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.vaultEvent.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
    });
  }

  async countByVaultId(vaultId: string, options?: { status?: StellarSubmissionStatus }) {
    const where: Prisma.VaultEventWhereInput = { vaultId };
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.vaultEvent.count({ where });
  }

  async findPending(limit = 50) {
    return prisma.vaultEvent.findMany({
      where: {
        status: {
          in: [StellarSubmissionStatus.SUBMITTED, StellarSubmissionStatus.REQUESTED],
        },
        attempts: { lt: 5 },
      },
      orderBy: { requestedAt: 'asc' },
      take: limit,
    });
  }

  async update(id: string, data: Prisma.VaultEventUncheckedUpdateInput) {
    return prisma.vaultEvent.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async updateStatus(
    id: string,
    status: StellarSubmissionStatus,
    extra?: Record<string, any>
  ) {
    return prisma.vaultEvent.update({
      where: { id },
      data: {
        status,
        ...extra,
        updatedAt: new Date(),
        attempts: { increment: 1 },
        ...(status === StellarSubmissionStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
        ...(status === StellarSubmissionStatus.FAILED ? { failedAt: new Date() } : {}),
      },
    });
  }

  async findByTransactionHash(transactionHash: string) {
    return prisma.vaultEvent.findUnique({
      where: { transactionHash },
    });
  }
}

export const vaultEventRepository = new VaultEventRepository();
