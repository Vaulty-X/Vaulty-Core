import { Router, Request, Response } from 'express';
import { prisma } from '../database';
import { redis } from '../config/redis';
import { getBootstrappedWorkers } from '../jobs';
import { redactError } from '../utils/redact';

const router = Router();

type HealthStatus = 'ok' | 'degraded';

type HealthCheck = {
  status: HealthStatus;
  details?: string;
};

const checkPrisma = async (): Promise<HealthCheck> => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return { status: 'ok' };
  } catch (error) {
    return { status: 'degraded', details: redactError(error) };
  }
};

const checkRedis = (): HealthCheck => {
  if (redis.status === 'ready') {
    return { status: 'ok' };
  }

  return { status: 'degraded', details: `Redis status is ${redis.status}` };
};

const checkWorkers = (): HealthCheck => {
  const workers = getBootstrappedWorkers();
  if (!workers || workers.length === 0) {
    return { status: 'degraded', details: 'Workers have not been bootstrapped yet' };
  }

  return { status: 'ok', details: `${workers.length} worker(s) bootstrapped` };
};

router.get('/', async (_req: Request, res: Response) => {
  const [prismaCheck, redisCheck, workersCheck] = await Promise.all([
    checkPrisma(),
    checkRedis(),
    Promise.resolve(checkWorkers()),
  ]);

  const isReady = prismaCheck.status === 'ok' && redisCheck.status === 'ok' && workersCheck.status === 'ok';

  res.json({
    success: true,
    message: 'Vaulty Backend is running',
    status: isReady ? 'ok' : 'degraded',
    ready: isReady,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      prisma: prismaCheck,
      redis: redisCheck,
      workers: workersCheck,
    },
  });
});

export const healthRouter = router;
