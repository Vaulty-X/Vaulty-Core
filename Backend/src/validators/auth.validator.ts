import { z } from 'zod';
import { normalizeEmail, normalizePhoneNumber } from '../utils/identity';

const emailField = z
  .string()
  .trim()
  .email('Invalid email address')
  .transform((value) => normalizeEmail(value));

const phoneNumberField = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .transform((value, ctx) => {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Invalid phone number. Use Nigerian local (08012345678) or E.164 (+2348012345678) format.',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phoneNumber: phoneNumberField.optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
  device: z.string().max(255).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  device: z.string().max(255).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendVerificationEmailSchema = z.object({
  email: emailField,
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationEmailInput = z.infer<typeof resendVerificationEmailSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
