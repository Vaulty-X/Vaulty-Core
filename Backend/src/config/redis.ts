import Redis from 'ioredis';
import { config } from './index';
import { redactError } from '../utils/redact';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', redactError(err));
});

export const disconnectRedis = async (): Promise<void> => {
  if (redis.status === 'ready' || redis.status === 'connect' || redis.status === 'reconnecting') {
    await redis.quit();
    return;
  }

  redis.disconnect();
};

export { redis };
