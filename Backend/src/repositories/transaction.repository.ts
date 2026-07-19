import { Prisma } from '@prisma/client';
import { prisma } from '../database';

export const SUBMISSION_STATUS = {
  REQUESTED: 'REQUESTED',
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];

export class TransactionRepository {
  async create(data: Prisma.StellarSubmissionUncheckedCreateInput) {
    return prisma.stellarSubmission.create({ data });
  }

  async findById(apiTransactionId: string) {
    return prisma.stellarSubmission.findUnique({
      where: { apiTransactionId },
    });
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return prisma.stellarSubmission.findUnique({
      where: { idempotencyKey },
    });
  }

  async findByHash(hash: string) {
    return prisma.stellarSubmission.findUnique({
      where: { stellarTxHash: hash },
    });
  }

  async update(
    apiTransactionId: string,
    data: Prisma.StellarSubmissionUncheckedUpdateInput
  ) {
    return prisma.stellarSubmission.update({
      where: { apiTransactionId },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /**
   * Returns submissions that are still awaiting chain confirmation and have
   * not exceeded their retry budget. Used by the reconciliation worker.
   */
  async findPending(limit = 50) {
    return prisma.stellarSubmission.findMany({
      where: {
        status: {
          in: [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.REQUESTED],
        },
        attempts: { lt: 5 },
      },
      orderBy: { requestedAt: 'asc' },
      take: limit,
    });
  }
}

export const transactionRepository = new TransactionRepository();
