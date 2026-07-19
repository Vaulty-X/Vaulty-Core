import { Prisma } from '@prisma/client';
import { prisma } from '../database';

export const PAYMENT_STATUS = {
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  REQUIRES_ACTION: 'REQUIRES_ACTION',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
} as const;

export const VALID_TRANSITIONS: Record<string, Set<string>> = {
  INITIATED: new Set(['PENDING', 'CANCELLED']),
  PENDING: new Set(['PROCESSING', 'REQUIRES_ACTION', 'FAILED', 'CANCELLED']),
  PROCESSING: new Set(['COMPLETED', 'FAILED', 'REVERSED']),
  REQUIRES_ACTION: new Set(['PROCESSING', 'FAILED', 'CANCELLED']),
  COMPLETED: new Set(),
  FAILED: new Set(['PENDING']),
  REVERSED: new Set(),
  CANCELLED: new Set(),
};

export class PaymentRepository {
  async create(data: Prisma.PaymentUncheckedCreateInput) {
    return prisma.payment.create({ data });
  }

  async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { auditLogs: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return prisma.payment.findUnique({ where: { idempotencyKey } });
  }

  async findByProviderReference(providerReference: string) {
    return prisma.payment.findUnique({ where: { providerReference } });
  }

  async findByUserId(userId: string, options?: { skip?: number; take?: number }) {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.payment.update({
      where: { id },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
    });
  }

  async updateProviderReference(id: string, providerReference: string) {
    return prisma.payment.update({
      where: { id },
      data: { providerReference },
    });
  }

  async update(id: string, data: Prisma.PaymentUncheckedUpdateInput) {
    return prisma.payment.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async findPendingByStatus(status: string, limit = 50) {
    return prisma.payment.findMany({
      where: { status: status as any },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const paymentRepository = new PaymentRepository();
