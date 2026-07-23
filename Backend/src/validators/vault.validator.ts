import { z } from 'zod';

export const createVaultSchema = z.object({
  name: z
    .string()
    .min(1, 'Vault name is required')
    .max(100, 'Vault name must not exceed 100 characters'),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  targetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Target amount must be a valid decimal number')
    .refine((val) => parseFloat(val) > 0, 'Target amount must be greater than 0'),
  lockPeriod: z
    .number()
    .int()
    .positive('Lock period must be a positive integer')
    .max(3650, 'Lock period cannot exceed 10 years (3650 days)')
    .optional(),
  assetCode: z
    .string()
    .min(1, 'Asset code is required')
    .max(20, 'Asset code must not exceed 20 characters')
    .default('USDC'),
  assetIssuer: z
    .string()
    .max(56, 'Asset issuer must not exceed 56 characters')
    .optional(),
  contractAddress: z
    .string()
    .max(56, 'Contract address must not exceed 56 characters')
    .optional(),
  onChainVaultId: z
    .string()
    .max(100, 'On-chain vault ID must not exceed 100 characters')
    .optional(),
  type: z.enum(['PERSONAL', 'GROUP', 'GOAL_ORIENTED']).default('PERSONAL'),
  goalDescription: z
    .string()
    .max(500, 'Goal description must not exceed 500 characters')
    .optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
});

export const depositToVaultSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal number')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  description: z
    .string()
    .max(255, 'Description must not exceed 255 characters')
    .optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
});

export const withdrawFromVaultSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal number')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  description: z
    .string()
    .max(255, 'Description must not exceed 255 characters')
    .optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(64, 'Idempotency key must not exceed 64 characters'),
});

export const lockVaultSchema = z.object({
  lockPeriod: z
    .number()
    .int()
    .positive('Lock period must be a positive integer')
    .max(3650, 'Lock period cannot exceed 10 years'),
});

export const getVaultHistorySchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'])
    .optional(),
  type: z
    .enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'INTEREST'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getVaultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['ACTIVE', 'LOCKED', 'CLOSED'])
    .optional(),
  type: z
    .enum(['PERSONAL', 'GROUP', 'GOAL_ORIENTED'])
    .optional(),
});

export type CreateVaultInput = z.infer<typeof createVaultSchema>;
export type DepositToVaultInput = z.infer<typeof depositToVaultSchema>;
export type WithdrawFromVaultInput = z.infer<typeof withdrawFromVaultSchema>;
export type LockVaultInput = z.infer<typeof lockVaultSchema>;
export type GetVaultHistoryInput = z.infer<typeof getVaultHistorySchema>;
export type GetVaultsQueryInput = z.infer<typeof getVaultsQuerySchema>;
