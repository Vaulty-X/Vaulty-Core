import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { AppError } from '../utils/AppError';

export class TransactionController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const record = await transactionService.submit(userId, req.body);
      const status = record.status === 'REQUESTED' ? 202 : 200;
      res.status(status).json({
        success: true,
        data: { transaction: record },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const apiTransactionId = req.params.apiTransactionId as string;
      if (!apiTransactionId) {
        throw new AppError('Transaction ID is required', 400);
      }

      const record = await transactionService.getStatus(apiTransactionId, userId);
      res.status(200).json({
        success: true,
        data: { transaction: record },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
