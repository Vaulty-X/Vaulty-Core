import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database';
import { VaultStatus, VaultTransactionStatus } from '@prisma/client';

const app = createApp();

jest.mock('../../src/queues', () => ({
  getVaultQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  getNotificationQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  getStreakQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  getEmailQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  getPaymentQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  getTransactionQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
  QUEUE_NAMES: {},
}));

describe('Vault Integration Tests', () => {
  const ownerUserId = 'vault-user-1';
  const otherUserId = 'other-user-1';

  const getAuthHeader = (userId: string = ownerUserId) => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId, email: `${userId}@example.com`, role: 'USER' },
      process.env.JWT_ACCESS_SECRET || 'test-secret-key',
      { expiresIn: '15m' }
    );
    return `Bearer ${token}`;
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.vaultTransaction.deleteMany({ where: { userId: ownerUserId } });
    await prisma.vaultTransaction.deleteMany({ where: { userId: otherUserId } });
    await prisma.vaultEvent.deleteMany({ where: { userId: ownerUserId } });
    await prisma.vaultEvent.deleteMany({ where: { userId: otherUserId } });
    await prisma.savingsVault.deleteMany({ where: { userId: ownerUserId } });
    await prisma.savingsVault.deleteMany({ where: { userId: otherUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.vaultTransaction.deleteMany({ where: { userId: ownerUserId } });
    await prisma.vaultTransaction.deleteMany({ where: { userId: otherUserId } });
    await prisma.vaultEvent.deleteMany({ where: { userId: ownerUserId } });
    await prisma.vaultEvent.deleteMany({ where: { userId: otherUserId } });
    await prisma.savingsVault.deleteMany({ where: { userId: ownerUserId } });
    await prisma.savingsVault.deleteMany({ where: { userId: otherUserId } });
  });

  describe('POST /api/v1/vaults', () => {
    it('creates a vault for an authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/vaults')
        .set('Authorization', getAuthHeader())
        .send({
          name: 'My Savings',
          targetAmount: '5000',
          idempotencyKey: 'idem-vault-create-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vault.name).toBe('My Savings');
      expect(res.body.data.vault.status).toBe(VaultStatus.ACTIVE);
    });

    it('returns the same vault for a duplicate idempotency key', async () => {
      const body = {
        name: 'My Savings',
        targetAmount: '5000',
        idempotencyKey: 'idem-vault-create-dup',
      };

      const first = await request(app)
        .post('/api/v1/vaults')
        .set('Authorization', getAuthHeader())
        .send(body);

      const second = await request(app)
        .post('/api/v1/vaults')
        .set('Authorization', getAuthHeader())
        .send(body);

      expect(second.status).toBe(201);
      expect(second.body.data.vault.id).toBe(first.body.data.vault.id);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/vaults')
        .send({ name: 'My Savings', targetAmount: '5000', idempotencyKey: 'idem-vault-noauth' });

      expect(res.status).toBe(401);
    });

    it('validates request body', async () => {
      const res = await request(app)
        .post('/api/v1/vaults')
        .set('Authorization', getAuthHeader())
        .send({ idempotencyKey: 'idem-vault-bad' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/vaults', () => {
    it('lists vaults for the authenticated user', async () => {
      await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Vault 1',
          targetAmount: '1000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .get('/api/v1/vaults')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.vaults.length).toBeGreaterThanOrEqual(1);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.savingsVault.create({
          data: {
            userId: ownerUserId,
            name: `Vault ${i}`,
            targetAmount: '1000',
            type: 'PERSONAL',
            status: 'ACTIVE',
          },
        });
      }

      const res = await request(app)
        .get('/api/v1/vaults?page=1&limit=2')
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.vaults.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  describe('GET /api/v1/vaults/:vaultId', () => {
    it('returns the vault detail for the owner', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Detail Vault',
          targetAmount: '2000',
          type: 'GOAL_ORIENTED',
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .get(`/api/v1/vaults/${vault.id}`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.vault.id).toBe(vault.id);
    });

    it('returns 404 for another user\'s vault', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: otherUserId,
          name: 'Other Vault',
          targetAmount: '2000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .get(`/api/v1/vaults/${vault.id}`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/vaults/:vaultId/deposit', () => {
    it('creates a pending deposit transaction', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Deposit Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/deposit`)
        .set('Authorization', getAuthHeader())
        .send({ amount: '200', idempotencyKey: 'idem-dep-1' });

      expect(res.status).toBe(202);
      expect(res.body.data.transaction.status).toBe(VaultTransactionStatus.PENDING);
    });

    it('provides idempotent response for duplicate deposit keys', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Dup Deposit Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      const first = await request(app)
        .post(`/api/v1/vaults/${vault.id}/deposit`)
        .set('Authorization', getAuthHeader())
        .send({ amount: '200', idempotencyKey: 'idem-dep-dup' });

      const second = await request(app)
        .post(`/api/v1/vaults/${vault.id}/deposit`)
        .set('Authorization', getAuthHeader())
        .send({ amount: '200', idempotencyKey: 'idem-dep-dup' });

      expect(second.body.data.transaction.id).toBe(first.body.data.transaction.id);
    });
  });

  describe('POST /api/v1/vaults/:vaultId/withdraw', () => {
    it('creates a pending withdrawal transaction', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Withdraw Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
          currentAmount: '500',
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/withdraw`)
        .set('Authorization', getAuthHeader())
        .send({ amount: '100', idempotencyKey: 'idem-wth-1' });

      expect(res.status).toBe(202);
      expect(res.body.data.transaction.status).toBe(VaultTransactionStatus.PENDING);
    });

    it('rejects withdrawal exceeding available balance', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Low Balance Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
          currentAmount: '50',
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/withdraw`)
        .set('Authorization', getAuthHeader())
        .send({ amount: '100', idempotencyKey: 'idem-wth-over' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/vaults/:vaultId/lock', () => {
    it('locks an active vault', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Lockable Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/lock`)
        .set('Authorization', getAuthHeader())
        .send({ lockPeriod: 30 });

      expect(res.status).toBe(200);
      expect(res.body.data.vault.status).toBe(VaultStatus.LOCKED);
    });

    it('rejects locking a closed vault', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Closed Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: VaultStatus.CLOSED,
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/lock`)
        .set('Authorization', getAuthHeader())
        .send({ lockPeriod: 30 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/vaults/:vaultId/unlock', () => {
    it('unlocks a vault past its unlock date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'Unlockable Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: VaultStatus.LOCKED,
          lockedAt: new Date(),
          unlocksAt: pastDate,
        },
      });

      const res = await request(app)
        .post(`/api/v1/vaults/${vault.id}/unlock`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.vault.status).toBe(VaultStatus.ACTIVE);
    });
  });

  describe('GET /api/v1/vaults/:vaultId/history', () => {
    it('returns paginated history for a vault', async () => {
      const vault = await prisma.savingsVault.create({
        data: {
          userId: ownerUserId,
          name: 'History Vault',
          targetAmount: '5000',
          type: 'PERSONAL',
          status: 'ACTIVE',
        },
      });

      await prisma.vaultTransaction.createMany({
        data: Array.from({ length: 5 }).map((_, i) => ({
          vaultId: vault.id,
          userId: ownerUserId,
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          amount: '100',
          reference: `dep-hist-${i}`,
          requestedAt: new Date(Date.now() - i * 1000),
        })),
      });

      const res = await request(app)
        .get(`/api/v1/vaults/${vault.id}/history?page=1&limit=2`)
        .set('Authorization', getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.transactions.length).toBe(2);
      expect(res.body.pagination.total).toBe(5);
    });
  });
});
