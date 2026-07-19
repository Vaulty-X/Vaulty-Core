import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database';
import { SUBMISSION_STATUS } from '../../src/repositories/transaction.repository';

const app = createApp();

// Keep the whole pipeline offline: stub the Stellar client and the queue so we
// exercise the HTTP -> service -> repository -> Postgres path without a live
// Horizon node or Redis.
jest.mock('../../src/blockchain/stellar/client', () => {
  const actual = jest.requireActual('../../src/blockchain/stellar/client');
  const fakeSubmitted = { hash: 'testhash123', ledger: 10, success: true };
  return {
    stellarClient: {
      getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
      decodeTransaction: (xdr: string) => {
        if (!xdr.startsWith('AAAA')) {
          throw new Error('malformed');
        }
        return {
          networkPassphrase: 'Test SDF Network ; September 2015',
          operations: [{ type: 'payment' }],
        };
      },
      submitTransaction: jest.fn().mockResolvedValue(fakeSubmitted),
      getTransaction: jest.fn().mockResolvedValue({ successful: true, ledger: 11 }),
    },
    StellarClient: actual.StellarClient,
  };
});

jest.mock('../../src/queues', () => ({
  getTransactionQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
}));

describe('Transaction Integration Tests', () => {
  const validUserId = 'txn-user-1';

  const getAuthHeader = () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: validUserId, email: 'txn@example.com', role: 'USER' },
      process.env.JWT_ACCESS_SECRET || 'test-secret-key',
      { expiresIn: '15m' }
    );
    return `Bearer ${token}`;
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.stellarSubmission.deleteMany({ where: { userId: validUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.stellarSubmission.deleteMany({ where: { userId: validUserId } });
  });

  describe('POST /api/v1/transactions/submit', () => {
    it('returns a stable API transaction id and SUBMITTED state for a valid XDR', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', getAuthHeader())
        .send({
          signedXdr: 'AAAA' + 'B'.repeat(300),
          idempotencyKey: 'idem-integration-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.apiTransactionId).toMatch(/^txn_/);
      expect(res.body.data.transaction.status).toBe(SUBMISSION_STATUS.SUBMITTED);
      expect(res.body.data.transaction.stellarTxHash).toBe('testhash123');

      const persisted = await prisma.stellarSubmission.findUnique({
        where: { idempotencyKey: 'idem-integration-1' },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe(SUBMISSION_STATUS.SUBMITTED);
    });

    it('returns the same record for a duplicate idempotency key', async () => {
      const send = () =>
        request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', getAuthHeader())
          .send({ signedXdr: 'AAAA' + 'B'.repeat(300), idempotencyKey: 'idem-integration-dup' });

      const first = await send();
      const second = await send();

      expect(first.body.data.transaction.apiTransactionId).toBe(
        second.body.data.transaction.apiTransactionId
      );
      const count = await prisma.stellarSubmission.count({
        where: { idempotencyKey: 'idem-integration-dup' },
      });
      expect(count).toBe(1);
    });

    it('rejects malformed XDR with a REJECTED record', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', getAuthHeader())
        .send({
          signedXdr: 'not-valid-xdr',
          idempotencyKey: 'idem-integration-bad',
        });

      expect(res.status).toBe(400);
      const persisted = await prisma.stellarSubmission.findUnique({
        where: { idempotencyKey: 'idem-integration-bad' },
      });
      expect(persisted?.status).toBe(SUBMISSION_STATUS.REJECTED);
      expect(persisted?.failureCode).toBe('INVALID_XDR');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/submit')
        .send({ signedXdr: 'AAAA' + 'B'.repeat(300), idempotencyKey: 'idem-noauth' });

      expect(res.status).toBe(401);
    });

    it('validates the request body', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', getAuthHeader())
        .send({ idempotencyKey: 'idem-incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/transactions/:apiTransactionId', () => {
    it('returns the transaction status for the owner', async () => {
      const created = await prisma.stellarSubmission.create({
        data: {
          apiTransactionId: 'txn-fetch-1',
          userId: validUserId,
          idempotencyKey: 'idem-fetch-1',
          status: SUBMISSION_STATUS.CONFIRMED,
          signedXdr: 'AAAA' + 'B'.repeat(300),
          networkPassphrase: 'Test SDF Network ; September 2015',
          stellarTxHash: 'hash-1',
          confirmedAt: new Date(),
        },
      });

      const res = await request(app)
        .get(`/api/v1/transactions/${created.apiTransactionId}`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.status).toBe(SUBMISSION_STATUS.CONFIRMED);
    });

    it('returns 404 for another user\'s transaction', async () => {
      const created = await prisma.stellarSubmission.create({
        data: {
          apiTransactionId: 'txn-fetch-2',
          userId: 'someone-else',
          idempotencyKey: 'idem-fetch-2',
          status: SUBMISSION_STATUS.SUBMITTED,
          signedXdr: 'AAAA' + 'B'.repeat(300),
          networkPassphrase: 'Test SDF Network ; September 2015',
        },
      });

      const res = await request(app)
        .get(`/api/v1/transactions/${created.apiTransactionId}`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(404);
    });
  });
});
