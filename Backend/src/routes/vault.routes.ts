import { Router } from 'express';
import { vaultController } from '../controllers/vault.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  createVaultSchema,
  depositToVaultSchema,
  withdrawFromVaultSchema,
  lockVaultSchema,
  getVaultHistorySchema,
  getVaultsQuerySchema,
} from '../validators/vault.validator';

const router = Router();

router.post('/', authenticate, validate(createVaultSchema), vaultController.createVault);
router.get('/', authenticate, validate(getVaultsQuerySchema), vaultController.getVaults);
router.get('/:vaultId', authenticate, vaultController.getVault);
router.post('/:vaultId/deposit', authenticate, validate(depositToVaultSchema), vaultController.deposit);
router.post('/:vaultId/withdraw', authenticate, validate(withdrawFromVaultSchema), vaultController.withdraw);
router.post('/:vaultId/lock', authenticate, validate(lockVaultSchema), vaultController.lockVault);
router.post('/:vaultId/unlock', authenticate, vaultController.unlockVault);
router.post('/:vaultId/close', authenticate, vaultController.closeVault);
router.get('/:vaultId/history', authenticate, validate(getVaultHistorySchema), vaultController.getVaultHistory);

export const vaultRouter = router;
