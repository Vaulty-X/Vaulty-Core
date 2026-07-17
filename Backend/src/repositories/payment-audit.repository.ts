import { Prisma } from '@prisma/client';
import { prisma } from '../database';

export class PaymentAuditLogRepository {
  async create(data: Prisma.PaymentAuditLogUncheckedCreateInput) {
    return prisma.paymentAuditLog.create({ data });
  }

  async findByPaymentId(paymentId: string) {
    return prisma.paymentAuditLog.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const paymentAuditLogRepository = new PaymentAuditLogRepository();
