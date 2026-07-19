import { z } from 'zod';

export const initiateDepositSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal number')
    .refine((val: string) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  asset: z.string().min(1, 'Asset is required').max(10).default('NGN'),
  method: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CARD']),
  bankAccount: z
    .string()
    .min(1, 'Bank account is required')
    .max(64, 'Bank account must not exceed 64 characters'),
  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(128, 'Account name must not exceed 128 characters'),
  narration: z.string().max(255).optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
});

export const initiateWithdrawalSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal number')
    .refine((val: string) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  asset: z.string().min(1, 'Asset is required').max(10).default('NGN'),
  method: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CARD']),
  bankAccount: z
    .string()
    .min(1, 'Bank account is required')
    .max(64, 'Bank account must not exceed 64 characters'),
  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(128, 'Account name must not exceed 128 characters'),
  narration: z.string().max(255).optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
});

export const getPaymentStatusSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export const getPaymentHistorySchema = z.object({
  direction: z.enum(['DEPOSIT', 'WITHDRAWAL']).optional(),
  status: z
    .enum([
      'INITIATED',
      'PENDING',
      'PROCESSING',
      'REQUIRES_ACTION',
      'COMPLETED',
      'FAILED',
      'REVERSED',
      'CANCELLED',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const webhookCallbackSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.string(), z.any()),
});

export type InitiateDepositInput = z.infer<typeof initiateDepositSchema>;
export type InitiateWithdrawalInput = z.infer<typeof initiateWithdrawalSchema>;
export type GetPaymentStatusInput = z.infer<typeof getPaymentStatusSchema>;
export type GetPaymentHistoryInput = z.infer<typeof getPaymentHistorySchema>;
export type WebhookCallbackInput = z.infer<typeof webhookCallbackSchema>;
