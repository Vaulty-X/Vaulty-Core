import { Router } from 'express';
import { anchorController } from '../controllers/anchor.controller';
import { verifyWebhookSignature } from '../middleware/webhook';
import { validate } from '../middleware/validator';
import { authenticate } from '../middleware/auth';
import {
  initiateDepositSchema,
  initiateWithdrawalSchema,
  getPaymentStatusSchema,
  getPaymentHistorySchema,
  webhookCallbackSchema,
} from '../validators/payment.validator';

const router = Router();

router.post('/deposits', authenticate, validate(initiateDepositSchema), anchorController.initiateDeposit);
router.post('/withdrawals', authenticate, validate(initiateWithdrawalSchema), anchorController.initiateWithdrawal);
router.get('/payments/:paymentId', authenticate, validate(getPaymentStatusSchema), anchorController.getPaymentStatus);
router.get('/payments', authenticate, validate(getPaymentHistorySchema), anchorController.getPaymentHistory);
router.post('/payments/:paymentId/instructions', authenticate, anchorController.requestInstructions);
router.post('/payments/:paymentId/cancel', authenticate, anchorController.cancelPayment);
router.post('/payments/:paymentId/retry', authenticate, anchorController.retryPayment);

router.post(
  '/webhooks/anchor',
  verifyWebhookSignature,
  validate(webhookCallbackSchema),
  anchorController.handleWebhook
);

export const anchorRouter = router;
