import { Queue, Worker } from 'bullmq';
import { config } from '../config';

// Queue names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  STREAK_CALCULATION: 'streak-calculation',
  EMAIL: 'email',
  PAYMENT_PROCESSING: 'payment-processing',
} as const;

// Connection options for BullMQ
const connectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
};

const queues = new Map<string, Queue>();
const workers: Worker[] = [];

const getQueue = (queueName: string): Queue => {
  const cachedQueue = queues.get(queueName);
  if (cachedQueue) {
    return cachedQueue;
  }

  const queue = new Queue(queueName, { connection: connectionOptions });
  queues.set(queueName, queue);
  return queue;
};

export const getNotificationQueue = () => getQueue(QUEUE_NAMES.NOTIFICATIONS);
export const getStreakQueue = () => getQueue(QUEUE_NAMES.STREAK_CALCULATION);
export const getEmailQueue = () => getQueue(QUEUE_NAMES.EMAIL);
export const getPaymentQueue = () => getQueue(QUEUE_NAMES.PAYMENT_PROCESSING);

export type VerificationEmailJob = {
  type: 'verification';
  to: string;
  userId: string;
  token: string;
  expiresAt: string;
};

export type PasswordResetEmailJob = {
  type: 'password-reset';
  to: string;
  userId: string;
  token: string;
  expiresAt: string;
};

export type EmailJobData = VerificationEmailJob | PasswordResetEmailJob;

export type PaymentProcessJob = {
  paymentId: string;
  type: 'POLL_STATUS';
};

const emailJobOptions = {
  attempts: 3,
  removeOnComplete: true,
  removeOnFail: 100,
};

const paymentJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

export const queuePaymentProcess = async (data: PaymentProcessJob) => {
  const queue = getPaymentQueue();
  return queue.add('payment-process', data, paymentJobOptions);
};

export const queueVerificationEmail = async (data: Omit<VerificationEmailJob, 'type'>) => {
  const queue = getEmailQueue();
  return queue.add('send-verification-email', { type: 'verification', ...data }, emailJobOptions);
};

export const queuePasswordResetEmail = async (data: Omit<PasswordResetEmailJob, 'type'>) => {
  const queue = getEmailQueue();
  return queue.add('send-password-reset-email', { type: 'password-reset', ...data }, emailJobOptions);
};

// Worker factory function
export const createWorker = (
  queueName: string,
  processor: (job: any) => Promise<void>,
  options?: any
): Worker => {
  const worker = new Worker(queueName, processor, {
    connection: connectionOptions,
    concurrency: 5,
    ...options,
  });

  workers.push(worker);
  return worker;
};

export const closeQueueConnections = async (): Promise<void> => {
  const closeTasks = [...workers, ...queues.values()].map((resource) => resource.close());
  await Promise.allSettled(closeTasks);
  workers.length = 0;
  queues.clear();
};

export const getBootstrappedWorkers = () => workers;
