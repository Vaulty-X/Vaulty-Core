import { createWorker, QUEUE_NAMES, queuePaymentProcess } from '../queues';
import { paymentRepository } from '../repositories/payment.repository';
import { paymentAuditLogRepository } from '../repositories/payment-audit.repository';
import { anchorService } from '../services/anchor.service';

// Example job processors - to be expanded as needed

export const notificationProcessor = async (job: any) => {
  console.log('Processing notification job:', job.id, job.data);
  // TODO: Implement notification logic
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export const streakProcessor = async (job: any) => {
  console.log('Processing streak calculation job:', job.id, job.data);
  // TODO: Implement streak calculation logic
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export const emailProcessor = async (job: { id?: string; data: any }) => {
  console.log('Processing email job:', job.id, {
    type: job.data.type,
    to: job.data.to,
    userId: job.data.userId,
    expiresAt: job.data.expiresAt,
  });
  // TODO: Implement email sending logic
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

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

export const paymentProcessor = async (job: any) => {
  const { paymentId, type } = job.data;
  console.log('Processing payment job:', job.id, { paymentId, type });

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    console.error(`Payment ${paymentId} not found`);
    return;
  }

  if (anchorService.isTerminalStatus(payment.status)) {
    console.log(`Payment ${paymentId} is in terminal state ${payment.status}, skipping`);
    return;
  }

  if (type === 'POLL_STATUS') {
    try {
      const status = await anchorService.pollProviderStatus(payment.providerReference || payment.id);
      const oldStatus = payment.status;
      const newStatus = anchorService.mapProviderStatusToInternal(status.status);

      if (newStatus !== oldStatus) {
        await paymentRepository.update(paymentId, { status: newStatus as any });

        const timestampFields: Record<string, string> = {};
        if (newStatus === 'COMPLETED') {
          timestampFields.confirmedAt = new Date().toISOString();
          timestampFields.settledAt = new Date().toISOString();
        } else if (newStatus === 'FAILED') {
          timestampFields.failedAt = new Date().toISOString();
          timestampFields.failureReason = status.failureReason || 'Provider processing failed';
        } else if (newStatus === 'REVERSED') {
          timestampFields.reversedAt = new Date().toISOString();
        }

        await paymentRepository.update(paymentId, timestampFields);

        await paymentAuditLogRepository.create({
          paymentId,
          action: AUDIT_ACTIONS.PROVIDER_CALLBACK,
          oldStatus: oldStatus as any,
          newStatus: newStatus as any,
          description: `Provider poll updated status to ${newStatus}`,
          providerReference: payment.providerReference || undefined,
          responsePayload: JSON.stringify(status),
        });

        console.log(`Payment ${paymentId} status updated: ${oldStatus} -> ${newStatus}`);

        if (!anchorService.isTerminalStatus(newStatus)) {
          await queuePaymentProcess({
            paymentId,
            type: 'POLL_STATUS',
          });
        }
      }
    } catch (error) {
      console.error(`Failed to poll payment ${paymentId}:`, error);
      throw error;
    }
  }
};

let workerRegistry: Record<string, any> | null = null;

// Initialize workers (call this in server.ts after Redis is connected)
export const initializeWorkers = () => {
  if (workerRegistry) {
    return workerRegistry;
  }

  const notificationWorker = createWorker(QUEUE_NAMES.NOTIFICATIONS, notificationProcessor);
  const streakWorker = createWorker(QUEUE_NAMES.STREAK_CALCULATION, streakProcessor);
  const emailWorker = createWorker(QUEUE_NAMES.EMAIL, emailProcessor);
  const paymentWorker = createWorker(QUEUE_NAMES.PAYMENT_PROCESSING, paymentProcessor);

  notificationWorker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  streakWorker.on('completed', (job) => {
    console.log(`Streak job ${job.id} completed`);
  });

  emailWorker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed`);
  });

  paymentWorker.on('completed', (job) => {
    console.log(`Payment job ${job.id} completed`);
  });

  paymentWorker.on('failed', (job, err) => {
    console.error(`Payment job ${job?.id} failed after retries:`, err.message);
    if (job?.data?.paymentId) {
      paymentAuditLogRepository.create({
        paymentId: job.data.paymentId,
        action: AUDIT_ACTIONS.FAILED,
        description: `Payment processing job failed permanently: ${err.message}`,
      }).catch(() => {});
    }
  });

  workerRegistry = { notificationWorker, streakWorker, emailWorker, paymentWorker };
  return workerRegistry;
};

export const getBootstrappedWorkers = () => workerRegistry;
