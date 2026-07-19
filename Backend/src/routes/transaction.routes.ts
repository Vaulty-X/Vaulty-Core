import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { submitTransactionSchema, getTransactionStatusSchema } from '../validators/transaction.validator';

const router = Router();

router.post('/submit', authenticate, validate(submitTransactionSchema), transactionController.submit);
router.get(
  '/:apiTransactionId',
  authenticate,
  validate(getTransactionStatusSchema),
  transactionController.getStatus
);

export const transactionRouter = router;
