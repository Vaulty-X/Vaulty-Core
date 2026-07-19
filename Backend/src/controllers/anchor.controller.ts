import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { AppError } from '../utils/AppError';

export class AnchorController {
  async initiateDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const payment = await paymentService.initiateDeposit(userId, req.body);
      res.status(201).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async initiateWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const payment = await paymentService.initiateWithdrawal(userId, req.body);
      res.status(201).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const paymentId = req.params.paymentId as string;
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      const payment = await paymentService.getPaymentStatus(userId, paymentId);
      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await paymentService.getPaymentHistory(userId, req.query as any);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async requestInstructions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const paymentId = req.params.paymentId as string;
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      const result = await paymentService.requestInstructions(paymentId, userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const paymentId = req.params.paymentId as string;
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      const payment = await paymentService.cancelPayment(paymentId, userId);
      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async retryPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const paymentId = req.params.paymentId as string;
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400);
      }

      const payment = await paymentService.retryPayment(paymentId);
      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.processProviderWebhook(req.body);
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const anchorController = new AnchorController();
