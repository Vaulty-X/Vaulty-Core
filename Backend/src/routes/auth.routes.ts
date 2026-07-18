import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validator';
import { authenticate } from '../middleware/auth';
import { authRateLimiter, sessionRateLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  logoutSchema,
} from '../validators/auth.validator';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', sessionRateLimiter, validate(refreshTokenSchema), authController.refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification-email', validate(resendVerificationEmailSchema), authController.resendVerificationEmail);
router.post('/logout', authenticate, sessionRateLimiter, validate(logoutSchema), authController.logout);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.post('/logout-all', authenticate, sessionRateLimiter, authController.logoutAll);

export const authRouter = router;
