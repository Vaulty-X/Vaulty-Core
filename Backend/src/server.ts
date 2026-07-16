import { createApp } from './app';
import { config } from './config';
import { redactError } from './utils/redact';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', redactError(err));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', redactError(reason));
  process.exit(1);
});

const app = createApp();

const startServer = (): void => {
  const port = config.port;

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port} in ${config.nodeEnv} mode`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', redactError(err));
    process.exit(1);
  });
};

startServer();
