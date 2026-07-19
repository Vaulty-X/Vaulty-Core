import { createApp } from './app';
import { config } from './config';
import { disconnectPrisma } from './database';
import { disconnectRedis } from './config/redis';
import { initializeWorkers } from './jobs';
import { closeQueueConnections } from './queues';
import { redactError } from './utils/redact';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', redactError(err));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', redactError(reason));
  process.exit(1);
});

let httpServer: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`🛑 Received ${signal}; shutting down gracefully...`);

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    await Promise.allSettled([disconnectPrisma(), disconnectRedis(), closeQueueConnections()]);
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', redactError(err));
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

const startServer = (): void => {
  const workerMode = process.argv.includes('--worker') || process.env.APP_MODE === 'worker';
  const shouldBootstrapWorkers = workerMode || config.nodeEnv !== 'test';

  if (shouldBootstrapWorkers) {
    initializeWorkers();
  }

  if (workerMode) {
    console.log('🤖 Worker mode enabled; queue processors are running');
    return;
  }

  const app = createApp();
  const port = config.port;

  httpServer = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port} in ${config.nodeEnv} mode`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
  });

  httpServer.on('error', (err) => {
    console.error('Failed to start server:', redactError(err));
    process.exit(1);
  });
};

startServer();
