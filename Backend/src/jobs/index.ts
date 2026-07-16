import { createWorker, EmailJobData, QUEUE_NAMES } from '../queues';

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

export const emailProcessor = async (job: { id?: string; data: EmailJobData }) => {
  console.log('Processing email job:', job.id, {
    type: job.data.type,
    to: job.data.to,
    userId: job.data.userId,
    expiresAt: job.data.expiresAt,
  });
  // TODO: Implement email sending logic
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export const paymentProcessor = async (job: any) => {
  console.log('Processing payment job:', job.id, job.data);
  // TODO: Implement payment processing logic
  await new Promise((resolve) => setTimeout(resolve, 1000));
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

  workerRegistry = { notificationWorker, streakWorker, emailWorker, paymentWorker };
  return workerRegistry;
};

export const getBootstrappedWorkers = () => workerRegistry;
