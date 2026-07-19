import { createApp } from '../../src/app';
import request from 'supertest';

// Mock express-rate-limit to avoid rate-limiting issues in tests
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return (_req: any, _res: any, next: any) => next();
  });
});

describe('Validation Middleware Error Responses', () => {
  const app = createApp();

  describe('POST /api/v1/auth/register', () => {
    it('should return structured failures for invalid email and weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: '123', // too short, no uppercase, no lowercase
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['email'],
            code: 'invalid_format',
            message: 'Invalid email address',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'too_small',
            message: 'Password must be at least 8 characters',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'invalid_format',
            message: 'Password must contain at least one uppercase letter',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'invalid_format',
            message: 'Password must contain at least one lowercase letter',
          }),
        ]),
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return structured failures for empty email and missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['email'],
            code: 'invalid_format',
            message: 'Invalid email address',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'invalid_type',
            message: 'Invalid input: expected string, received undefined',
          }),
        ]),
      });
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should return structured failures for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            path: ['refreshToken'],
            code: 'invalid_type',
            message: 'Invalid input: expected string, received undefined',
          },
        ],
      });
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should return structured failures for missing token and weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['token'],
            code: 'invalid_type',
            message: 'Invalid input: expected string, received undefined',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'too_small',
            message: 'Password must be at least 8 characters',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'invalid_format',
            message: 'Password must contain at least one uppercase letter',
          }),
          expect.objectContaining({
            path: ['password'],
            code: 'invalid_format',
            message: 'Password must contain at least one number',
          }),
        ]),
      });
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return structured failures for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            path: ['email'],
            code: 'invalid_format',
            message: 'Invalid email address',
          },
        ],
      });
    });
  });
});
