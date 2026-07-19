import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database';
import { paymentRepository } from '../../src/repositories/payment.repository';

const app = createApp();

describe('Anchor Integration Tests', () => {
  const validUserId = 'user-123';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { userId: validUserId } });
  });

  const getAuthHeader = () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: validUserId, email: 'test@example.com', role: 'USER' },
      process.env.JWT_ACCESS_SECRET || 'test-secret-key',
      { expiresIn: '15m' }
    );
    return `Bearer ${token}`;
  };

  describe('POST /api/v1/anchor/deposits', () => {
    it('should create a deposit payment', async () => {
      const res = await request(app)
        .post('/api/v1/anchor/deposits')
        .set('Authorization', getAuthHeader())
        .send({
          amount: '1000',
          asset: 'NGN',
          method: 'BANK_TRANSFER',
          bankAccount: '1234567890',
          accountName: 'John Doe',
          idempotencyKey: 'idempotency-deposit-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.direction).toBe('DEPOSIT');
      expect(res.body.data.payment.status).toBe('INITIATED');
    });

    it('should return existing payment for duplicate idempotency key', async () => {
      const payment = await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'INITIATED',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-deposit-dup',
        provider: 'ANCHOR',
        reference: 'DEP-dup-1',
      });

      const res = await request(app)
        .post('/api/v1/anchor/deposits')
        .set('Authorization', getAuthHeader())
        .send({
          amount: '1000',
          asset: 'NGN',
          method: 'BANK_TRANSFER',
          bankAccount: '1234567890',
          accountName: 'John Doe',
          idempotencyKey: 'idempotency-deposit-dup',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payment.id).toBe(payment.id);
    });
  });

  describe('POST /api/v1/anchor/withdrawals', () => {
    it('should create a withdrawal payment', async () => {
      const res = await request(app)
        .post('/api/v1/anchor/withdrawals')
        .set('Authorization', getAuthHeader())
        .send({
          amount: '500',
          asset: 'NGN',
          method: 'BANK_TRANSFER',
          bankAccount: '9876543210',
          accountName: 'Jane Doe',
          idempotencyKey: 'idempotency-withdrawal-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.direction).toBe('WITHDRAWAL');
      expect(res.body.data.payment.status).toBe('INITIATED');
    });
  });

  describe('GET /api/v1/anchor/payments/:paymentId', () => {
    it('should return payment status', async () => {
      const payment = await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'PENDING',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-status-1',
        provider: 'ANCHOR',
        reference: 'DEP-status-1',
      });

      const res = await request(app)
        .get(`/api/v1/anchor/payments/${payment.id}`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.id).toBe(payment.id);
    });

    it('should return 404 for non-existent payment', async () => {
      const res = await request(app)
        .get('/api/v1/anchor/payments/nonexistent')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/anchor/payments', () => {
    it('should return payment history with pagination', async () => {
      await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'COMPLETED',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-history-1',
        provider: 'ANCHOR',
        reference: 'DEP-history-1',
      });

      const res = await request(app)
        .get('/api/v1/anchor/payments?page=1&limit=10')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should filter payments by direction', async () => {
      await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'COMPLETED',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-filter-1',
        provider: 'ANCHOR',
        reference: 'DEP-filter-1',
      });

      await paymentRepository.create({
        userId: validUserId,
        direction: 'WITHDRAWAL',
        status: 'COMPLETED',
        amount: '500',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '9876543210',
        accountName: 'Jane Doe',
        idempotencyKey: 'idempotency-filter-2',
        provider: 'ANCHOR',
        reference: 'WTH-filter-1',
      });

      const res = await request(app)
        .get('/api/v1/anchor/payments?direction=DEPOSIT')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0].direction).toBe('DEPOSIT');
    });
  });

  describe('POST /api/v1/anchor/webhooks/anchor', () => {
    it('should process valid webhook', async () => {
      await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'PENDING',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-webhook-1',
        provider: 'ANCHOR',
        reference: 'DEP-webhook-1',
        providerReference: 'REF-webhook-1',
      });

      const webhookPayload = {
        event: 'payment.completed',
        reference: 'REF-webhook-1',
        status: 'SUCCESS',
        amount: '1000',
        currency: 'NGN',
        timestamp: new Date().toISOString(),
      };

      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.ANCHOR_WEBHOOK_SECRET || 'dev-webhook-secret')
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/anchor/webhooks/anchor')
        .set('x-anchor-signature', signature)
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const res = await request(app)
        .post('/api/v1/anchor/webhooks/anchor')
        .set('x-anchor-signature', 'invalid-signature')
        .send({
          event: 'payment.completed',
          reference: 'REF-123',
          status: 'SUCCESS',
        });

      expect(res.status).toBe(401);
    });

    it('should reject webhook with missing signature', async () => {
      const res = await request(app)
        .post('/api/v1/anchor/webhooks/anchor')
        .send({
          event: 'payment.completed',
          reference: 'REF-123',
          status: 'SUCCESS',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('State machine validation', () => {
    it('should reject invalid state transitions', async () => {
      await paymentRepository.create({
        userId: validUserId,
        direction: 'DEPOSIT',
        status: 'COMPLETED',
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-trans-1',
        provider: 'ANCHOR',
        reference: 'DEP-trans-1',
      });

      const res = await request(app)
        .post('/api/v1/anchor/payments/DEP-trans-1/cancel')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
