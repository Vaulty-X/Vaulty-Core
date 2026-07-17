import { Prisma } from '@prisma/client';
import type { PaymentDirection, PaymentStatus } from '@prisma/client';
import { paymentRepository, VALID_TRANSITIONS, PAYMENT_STATUS } from '../repositories/payment.repository';
import { paymentAuditLogRepository } from '../repositories/payment-audit.repository';
import { anchorService } from './anchor.service';
import { AppError } from '../utils/AppError';
import { getPaymentQueue } from '../queues';
import { prisma } from '../database';
import type {
  InitiateDepositInput,
  InitiateWithdrawalInput,
} from '../validators/payment.validator';

const AUDIT_ACTIONS = {
  CREATED: 'CREATED',
  INITIATED: 'INITIATED',
  INSTRUCTIONS_SENT: 'INSTRUCTIONS_SENT',
  PROVIDER_CALLBACK: 'PROVIDER_CALLBACK',
  CONFIRMED: 'CONFIRMED',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
  RETRY: 'RETRY',
  CANCELLED: 'CANCELLED',
} as const;

const generateReference = (direction: PaymentDirection): string => {
  const prefix = direction === 'DEPOSIT' ? 'DEP' : 'WTH';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export class PaymentService {
  async initiateDeposit(userId: string, input: InitiateDepositInput) {
    const existing = await paymentRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError('Idempotency key belongs to another user', 403);
      }
      return existing;
    }

    const payment = await paymentRepository.create({
      userId,
      direction: 'DEPOSIT',
      status: PAYMENT_STATUS.INITIATED,
      amount: input.amount,
      asset: input.asset,
      method: input.method,
      bankAccount: input.bankAccount,
      accountName: input.accountName,
      narration: input.narration,
      idempotencyKey: input.idempotencyKey,
      reference: generateReference('DEPOSIT'),
      provider: 'ANCHOR',
    });

    await paymentAuditLogRepository.create({
      paymentId: payment.id,
      action: AUDIT_ACTIONS.CREATED,
      description: 'Payment record created',
    });

    return payment;
  }

  async initiateWithdrawal(userId: string, input: InitiateWithdrawalInput) {
    const existing = await paymentRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError('Idempotency key belongs to another user', 403);
      }
      return existing;
    }

    const payment = await paymentRepository.create({
      userId,
      direction: 'WITHDRAWAL',
      status: PAYMENT_STATUS.INITIATED,
      amount: input.amount,
      asset: input.asset,
      method: input.method,
      bankAccount: input.bankAccount,
      accountName: input.accountName,
      narration: input.narration,
      idempotencyKey: input.idempotencyKey,
      reference: generateReference('WITHDRAWAL'),
      provider: 'ANCHOR',
    });

    await paymentAuditLogRepository.create({
      paymentId: payment.id,
      action: AUDIT_ACTIONS.CREATED,
      description: 'Payment record created',
    });

    return payment;
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.userId !== userId) {
      throw new AppError('Payment not found', 404);
    }
    return payment;
  }

  async getPaymentHistory(userId: string, filters?: { direction?: string; status?: string; page?: number; limit?: number }) {
    const where: Prisma.PaymentWhereInput = { userId };

    if (filters?.direction) {
      where.direction = filters.direction as PaymentDirection;
    }
    if (filters?.status) {
      where.status = filters.status as PaymentStatus;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      paymentRepository.findByUserId(userId, { skip, take: limit }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async requestInstructions(paymentId: string, userId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.userId !== userId) {
      throw new AppError('Payment not found', 404);
    }

    await this.ensureTransition(paymentId, PAYMENT_STATUS.INITIATED, PAYMENT_STATUS.PENDING);

    const instruction =
      payment.direction === 'DEPOSIT'
        ? await anchorService.requestDepositInstruction(
            userId,
            payment.amount,
            payment.bankAccount || '',
            payment.accountName || '',
            payment.narration || undefined
          )
        : await anchorService.requestWithdrawalInstruction(
            userId,
            payment.amount,
            payment.bankAccount || '',
            payment.accountName || ''
          );

    await paymentRepository.updateProviderReference(paymentId, instruction.reference);
    await paymentRepository.update(paymentId, { initiatedAt: new Date() });
    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.INITIATED,
      newStatus: PAYMENT_STATUS.PENDING,
      description: 'Provider instructions requested',
      providerReference: instruction.reference,
    });

    const queue = getPaymentQueue();
    await queue.add('payment-process', {
      paymentId,
      type: 'POLL_STATUS',
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { ...payment, providerReference: instruction.reference };
  }

  async processProviderWebhook(payload: { event: string; reference: string; status: string; amount?: string; currency?: string; transactionHash?: string; failureReason?: string; timestamp: string }) {
    const payment = await paymentRepository.findByProviderReference(payload.reference);
    if (!payment) {
      return { processed: false, reason: 'Payment not found' };
    }

    const oldStatus = payment.status;
    const newInternalStatus = anchorService.mapProviderStatusToInternal(payload.status);

    if (!VALID_TRANSITIONS[oldStatus]?.has(newInternalStatus)) {
      if (oldStatus === PAYMENT_STATUS.COMPLETED || oldStatus === PAYMENT_STATUS.FAILED || oldStatus === PAYMENT_STATUS.REVERSED || oldStatus === PAYMENT_STATUS.CANCELLED) {
        await paymentAuditLogRepository.create({
          paymentId: payment.id,
          action: AUDIT_ACTIONS.PROVIDER_CALLBACK,
          oldStatus,
          newStatus: newInternalStatus as PaymentStatus,
          description: 'Duplicate webhook ignored - payment already in terminal state',
        });
        return { processed: false, reason: 'Terminal state', paymentId: payment.id };
      }
    }

    const updateData: Prisma.PaymentUncheckedUpdateInput = { status: newInternalStatus as PaymentStatus };

    if (payload.transactionHash) {
      updateData.stellarTransactionHash = payload.transactionHash;
    }
    if (payload.failureReason) {
      updateData.failureReason = payload.failureReason;
    }

    if (newInternalStatus === 'COMPLETED') {
      updateData.confirmedAt = new Date();
      updateData.settledAt = new Date();
    } else if (newInternalStatus === 'FAILED') {
      updateData.failedAt = new Date();
    } else if (newInternalStatus === 'REVERSED') {
      updateData.reversedAt = new Date();
    } else if (newInternalStatus === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    await paymentRepository.update(payment.id, updateData);

    await paymentAuditLogRepository.create({
      paymentId: payment.id,
      action: AUDIT_ACTIONS.PROVIDER_CALLBACK,
      oldStatus,
      newStatus: newInternalStatus as PaymentStatus,
      description: `Provider callback: ${payload.event}`,
      responsePayload: JSON.stringify(payload),
    });

    if (anchorService.isTerminalStatus(newInternalStatus)) {
      return { processed: true, terminal: true, paymentId: payment.id, status: newInternalStatus };
    }

    return { processed: true, terminal: false, paymentId: payment.id, status: newInternalStatus };
  }

  async settlePayment(paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    if (payment.status !== PAYMENT_STATUS.PROCESSING && payment.status !== PAYMENT_STATUS.PENDING) {
      throw new AppError(`Cannot settle payment in ${payment.status} status`, 400);
    }

    await paymentRepository.update(paymentId, {
      status: PAYMENT_STATUS.COMPLETED,
      settledAt: new Date(),
    });

    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.SETTLED,
      newStatus: PAYMENT_STATUS.COMPLETED,
      description: 'Payment settled',
    });

    return payment;
  }

  async failPayment(paymentId: string, reason: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    await paymentRepository.update(paymentId, {
      status: PAYMENT_STATUS.FAILED,
      failureReason: reason,
      failedAt: new Date(),
    });

    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.FAILED,
      newStatus: PAYMENT_STATUS.FAILED,
      description: reason,
    });

    return payment;
  }

  async reversePayment(paymentId: string, reason: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    await paymentRepository.update(paymentId, {
      status: PAYMENT_STATUS.REVERSED,
      failureReason: reason,
      reversedAt: new Date(),
    });

    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.REVERSED,
      newStatus: PAYMENT_STATUS.REVERSED,
      description: reason,
    });

    return payment;
  }

  async cancelPayment(paymentId: string, userId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.userId !== userId) {
      throw new AppError('Payment not found', 404);
    }

    const allowedCancelStatuses = [PAYMENT_STATUS.INITIATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REQUIRES_ACTION] as string[];
    if (!allowedCancelStatuses.includes(payment.status)) {
      throw new AppError(
        `Invalid state transition: cannot cancel payment in ${payment.status} status`,
        400
      );
    }

    await paymentRepository.update(paymentId, {
      status: PAYMENT_STATUS.CANCELLED,
      cancelledAt: new Date(),
    });

    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.CANCELLED,
      oldStatus: payment.status as any,
      newStatus: PAYMENT_STATUS.CANCELLED,
      description: 'Payment cancelled by user',
    });

    return payment;
  }

  async retryPayment(paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    await this.ensureTransition(paymentId, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.PENDING);

    await paymentRepository.update(paymentId, {
      status: PAYMENT_STATUS.PENDING,
      failureReason: null,
    });

    await paymentAuditLogRepository.create({
      paymentId,
      action: AUDIT_ACTIONS.RETRY,
      oldStatus: PAYMENT_STATUS.FAILED,
      newStatus: PAYMENT_STATUS.PENDING,
      description: 'Payment retried',
    });

    const queue = getPaymentQueue();
    await queue.add('payment-process', {
      paymentId,
      type: 'POLL_STATUS',
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return payment;
  }

  private async ensureTransition(paymentId: string, from: string, to: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.status !== from) {
      throw new AppError(
        `Invalid state transition: cannot move from ${payment.status} to ${to}`,
        400
      );
    }
  }
}

export const paymentService = new PaymentService();
