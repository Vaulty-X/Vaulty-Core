import { Request, Response, NextFunction } from 'express';
import { anchorService } from '../services/anchor.service';
import { AppError } from '../utils/AppError';

export const verifyWebhookSignature = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const signature = req.headers['x-anchor-signature'] as string;
    if (!signature) {
      throw new AppError('Missing webhook signature', 401);
    }

    const payload = JSON.stringify(req.body);
    const isValid = anchorService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      throw new AppError('Invalid webhook signature', 401);
    }

    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Webhook verification failed', 401));
  }
};
