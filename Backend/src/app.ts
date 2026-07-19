import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { rateLimiter, errorHandler, notFoundHandler } from './middleware';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { anchorRouter } from './routes/anchor.routes';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.cors.origin.length === 1 ? config.cors.origin[0] : config.cors.origin,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  // Rate limiting
  app.use(rateLimiter);

  // Health check route
  app.use('/health', healthRouter);

  // API routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/anchor', anchorRouter);
  // app.use('/api/v1/wallets', walletRouter);
  // app.use('/api/v1/vaults', vaultRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
