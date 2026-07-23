import { Prisma, VaultStatus } from '@prisma/client';
import { prisma } from '../database';

export class VaultRepository {
  async create(data: Prisma.SavingsVaultUncheckedCreateInput) {
    return prisma.savingsVault.create({ data });
  }

  async findById(id: string) {
    return prisma.savingsVault.findUnique({ where: { id } });
  }

  async findByOnChainVaultId(onChainVaultId: string) {
    return prisma.savingsVault.findUnique({
      where: { onChainVaultId },
    });
  }

  async findByUserId(userId: string, options?: { skip?: number; take?: number; status?: VaultStatus }) {
    const where: Prisma.SavingsVaultWhereInput = { userId };
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.savingsVault.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
    });
  }

  async countByUserId(
    userId: string,
    options?: { status?: VaultStatus }
  ) {
    const where: Prisma.SavingsVaultWhereInput = { userId };
    if (options?.status) {
      where.status = options.status;
    }

    return prisma.savingsVault.count({ where });
  }

  async update(id: string, data: Prisma.SavingsVaultUncheckedUpdateInput) {
    return prisma.savingsVault.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async updateStatus(id: string, status: VaultStatus) {
    return prisma.savingsVault.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
        ...(status === VaultStatus.LOCKED ? { lockedAt: new Date() } : {}),
        ...(status === VaultStatus.CLOSED ? { updatedAt: new Date() } : {}),
      },
    });
  }

  async addBalance(id: string, amount: string) {
    return prisma.$executeRaw`
      UPDATE savings_vaults
      SET current_amount = current_amount + ${amount}::numeric,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  async subtractBalance(id: string, amount: string) {
    return prisma.$executeRaw`
      UPDATE savings_vaults
      SET current_amount = current_amount - ${amount}::numeric,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  async delete(id: string) {
    return prisma.savingsVault.delete({ where: { id } });
  }
}

export const vaultRepository = new VaultRepository();
