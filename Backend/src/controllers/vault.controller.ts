import { Request, Response, NextFunction } from 'express';
import { vaultService } from '../services/vault.service';
import { AppError } from '../utils/AppError';

export class VaultController {
  async createVault(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const vault = await vaultService.createVault(userId, req.body);
      res.status(201).json({
        success: true,
        data: { vault },
      });
    } catch (error) {
      next(error);
    }
  }

  async getVaults(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await vaultService.getVaults(userId, req.query as any);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVault(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const vault = await vaultService.getVault(userId, req.params.vaultId as string);
      res.status(200).json({
        success: true,
        data: { vault },
      });
    } catch (error) {
      next(error);
    }
  }

  async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const transaction = await vaultService.deposit(userId, req.params.vaultId as string, req.body);
      res.status(202).json({
        success: true,
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const transaction = await vaultService.withdraw(userId, req.params.vaultId as string, req.body);
      res.status(202).json({
        success: true,
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  }

  async lockVault(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const vault = await vaultService.lockVault(userId, req.params.vaultId as string, req.body);
      res.status(200).json({
        success: true,
        data: { vault },
      });
    } catch (error) {
      next(error);
    }
  }

  async unlockVault(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const vault = await vaultService.unlockVault(userId, req.params.vaultId as string);
      res.status(200).json({
        success: true,
        data: { vault },
      });
    } catch (error) {
      next(error);
    }
  }

  async closeVault(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const vault = await vaultService.closeVault(userId, req.params.vaultId as string);
      res.status(200).json({
        success: true,
        data: { vault },
      });
    } catch (error) {
      next(error);
    }
  }

  async getVaultHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await vaultService.getVaultHistory(userId, req.params.vaultId as string, req.query as any);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vaultController = new VaultController();
