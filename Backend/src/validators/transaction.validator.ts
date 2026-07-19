import { z } from 'zod';

export const submitTransactionSchema = z.object({
  signedXdr: z
    .string()
    .min(1, 'signedXdr is required')
    .max(100_000, 'signedXdr is too large'),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
  vaultId: z.string().max(64).optional(),
  paymentId: z.string().max(64).optional(),
});

export const getTransactionStatusSchema = z.object({
  apiTransactionId: z.string().min(1, 'Transaction ID is required'),
});

export type SubmitTransactionInput = z.infer<typeof submitTransactionSchema>;
export type GetTransactionStatusInput = z.infer<typeof getTransactionStatusSchema>;
