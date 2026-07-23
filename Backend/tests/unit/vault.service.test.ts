import { vaultService } from '../../src/services/vault.service';
import { AppError } from '../../src/utils/AppError';
import { VaultStatus, VaultTransactionStatus } from '@prisma/client';

jest.mock('../../src/repositories/vault.repository');
jest.mock('../../src/repositories/vault-transaction.repository');
jest.mock('../../src/repositories/vault-event.repository');
jest.mock('../../src/queues', () => ({
  getVaultQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
}));

const mockVaultRepository = require('../../src/repositories/vault.repository').vaultRepository;
const mockVaultTransactionRepository = require('../../src/repositories/vault-transaction.repository').vaultTransactionRepository;
const mockVaultEventRepository = require('../../src/repositories/vault-event.repository').vaultEventRepository;

const createMockVault = (overrides?: any) => ({
  id: 'vault-1',
  userId: 'user-1',
  name: 'Test Vault',
  description: 'A test vault',
  targetAmount: '1000',
  currentAmount: '0',
  type: 'PERSONAL',
  status: 'ACTIVE',
  targetDate: null,
  lockPeriod: 30,
  interestRate: null,
  assetCode: 'USDC',
  assetIssuer: null,
  contractAddress: null,
  onChainVaultId: null,
  lockedAt: null,
  unlocksAt: null,
  goalDescription: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockVaultTransaction = (overrides?: any) => ({
  id: 'vault-txn-1',
  vaultId: 'vault-1',
  userId: 'user-1',
  type: 'DEPOSIT',
  status: 'PENDING',
  amount: '100',
  fee: '0',
  description: null,
  reference: 'dep-123',
  idempotencyKey: 'idem-1',
  stellarTransactionHash: null,
  onChainVaultId: null,
  fromAddress: null,
  toAddress: null,
  failureCode: null,
  failureReason: null,
  requestedAt: new Date(),
  confirmedAt: null,
  failedAt: null,
  updatedAt: new Date(),
  ...overrides,
});

describe('VaultService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createVault', () => {
    it('should create a new vault', async () => {
      mockVaultRepository.create.mockResolvedValue(createMockVault());
      mockVaultEventRepository.create.mockResolvedValue({});
      mockVaultRepository.findByUserId.mockResolvedValue([]);

      const result = await vaultService.createVault('user-1', {
        name: 'Test Vault',
        targetAmount: '1000',
        idempotencyKey: 'idem-create-1',
        assetCode: 'USDC',
        type: 'PERSONAL',
      } as any);

      expect(result).toBeDefined();
      expect(mockVaultRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          name: 'Test Vault',
          targetAmount: '1000',
        })
      );
    });

    it('should create a vault event on creation', async () => {
      mockVaultRepository.create.mockResolvedValue(createMockVault());
      mockVaultRepository.findByUserId.mockResolvedValue([]);
      mockVaultEventRepository.create.mockResolvedValue({});

      await vaultService.createVault('user-1', {
        name: 'Test Vault',
        targetAmount: '1000',
        idempotencyKey: 'idem-create-2',
        assetCode: 'USDC',
        type: 'PERSONAL',
      } as any);

      expect(mockVaultEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CREATED',
          status: 'CONFIRMED',
        })
      );
    });
  });

  describe('getVaults', () => {
    it('should return paginated vaults for a user', async () => {
      mockVaultRepository.findByUserId.mockResolvedValue([createMockVault()]);
      mockVaultRepository.countByUserId.mockResolvedValue(1);

      const result = await vaultService.getVaults('user-1', { page: 1, limit: 20 });

      expect(result.vaults).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getVault', () => {
    it('should return vault for authorized user', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault());

      const result = await vaultService.getVault('user-1', 'vault-1');
      expect(result.id).toBe('vault-1');
    });

    it('should throw 404 for non-existent vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(null);

      await expect(vaultService.getVault('user-1', 'vault-999')).rejects.toThrow(AppError);
    });

    it('should throw 404 for another user\'s vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ userId: 'user-2' }));

      await expect(vaultService.getVault('user-1', 'vault-1')).rejects.toThrow(AppError);
    });
  });

  describe('deposit', () => {
    it('should create a pending deposit transaction', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault());
      mockVaultTransactionRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockVaultTransactionRepository.create.mockResolvedValue(createMockVaultTransaction());
      mockVaultEventRepository.create.mockResolvedValue({});

      const result = await vaultService.deposit('user-1', 'vault-1', {
        amount: '100',
        idempotencyKey: 'idem-dep-1',
      });

      expect(result.status).toBe(VaultTransactionStatus.PENDING);
      expect(mockVaultRepository.addBalance).not.toHaveBeenCalled();
    });

    it('should reject duplicate idempotency key for same user', async () => {
      const existing = createMockVaultTransaction();
      mockVaultRepository.findById.mockResolvedValue(createMockVault());
      mockVaultTransactionRepository.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await vaultService.deposit('user-1', 'vault-1', {
        amount: '100',
        idempotencyKey: 'idem-dep-dup',
      });

      expect(result).toBe(existing);
    });

    it('should reject duplicate idempotency key for different user', async () => {
      const existing = createMockVaultTransaction({ userId: 'user-2' });
      mockVaultRepository.findById.mockResolvedValue(createMockVault());
      mockVaultTransactionRepository.findByIdempotencyKey.mockResolvedValue(existing);

      await expect(
        vaultService.deposit('user-1', 'vault-1', { amount: '100', idempotencyKey: 'idem-dep-dup' })
      ).rejects.toThrow(AppError);
    });

    it('should reject deposit into closed vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ status: VaultStatus.CLOSED }));

      await expect(
        vaultService.deposit('user-1', 'vault-1', { amount: '100', idempotencyKey: 'idem-dep-closed' })
      ).rejects.toThrow('Cannot deposit into a closed vault');
    });
  });

  describe('withdraw', () => {
    it('should create a pending withdrawal transaction', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ currentAmount: '200' }));
      mockVaultTransactionRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockVaultTransactionRepository.create.mockResolvedValue(createMockVaultTransaction({ type: 'WITHDRAWAL' }));
      mockVaultEventRepository.create.mockResolvedValue({});

      const result = await vaultService.withdraw('user-1', 'vault-1', {
        amount: '100',
        idempotencyKey: 'idem-wth-1',
      });

      expect(result.type).toBe('WITHDRAWAL');
      expect(result.status).toBe(VaultTransactionStatus.PENDING);
    });

    it('should reject withdrawal exceeding balance', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ currentAmount: '50' }));

      await expect(
        vaultService.withdraw('user-1', 'vault-1', { amount: '100', idempotencyKey: 'idem-wth-over' })
      ).rejects.toThrow('Insufficient vault balance');
    });

    it('should reject withdrawal from locked vault before unlock date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      mockVaultRepository.findById.mockResolvedValue(
        createMockVault({ status: VaultStatus.LOCKED, unlocksAt: futureDate })
      );

      await expect(
        vaultService.withdraw('user-1', 'vault-1', { amount: '50', idempotencyKey: 'idem-wth-locked' })
      ).rejects.toThrow('Vault is locked until');
    });

    it('should reject withdrawal from closed vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ status: VaultStatus.CLOSED }));

      await expect(
        vaultService.withdraw('user-1', 'vault-1', { amount: '50', idempotencyKey: 'idem-wth-closed' })
      ).rejects.toThrow('Cannot withdraw from a closed vault');
    });
  });

  describe('lockVault', () => {
    it('should lock an active vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault());
      mockVaultRepository.update.mockResolvedValue(createMockVault({ status: VaultStatus.LOCKED }));
      mockVaultEventRepository.create.mockResolvedValue({});

      const result = await vaultService.lockVault('user-1', 'vault-1', { lockPeriod: 30 });

      expect(result.status).toBe(VaultStatus.LOCKED);
      expect(mockVaultRepository.update).toHaveBeenCalledWith(
        'vault-1',
        expect.objectContaining({ status: VaultStatus.LOCKED })
      );
    });

    it('should reject locking a closed vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ status: VaultStatus.CLOSED }));

      await expect(
        vaultService.lockVault('user-1', 'vault-1', { lockPeriod: 30 })
      ).rejects.toThrow('Cannot lock a closed vault');
    });
  });

  describe('unlockVault', () => {
    it('should unlock a vault past its unlock date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      mockVaultRepository.findById.mockResolvedValue(
        createMockVault({ status: VaultStatus.LOCKED, unlocksAt: pastDate })
      );
      mockVaultRepository.update.mockResolvedValue(createMockVault({ status: VaultStatus.ACTIVE }));
      mockVaultEventRepository.create.mockResolvedValue({});

      const result = await vaultService.unlockVault('user-1', 'vault-1');
      expect(result.status).toBe(VaultStatus.ACTIVE);
    });

    it('should reject unlocking a vault still in lock period', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      mockVaultRepository.findById.mockResolvedValue(
        createMockVault({ status: VaultStatus.LOCKED, unlocksAt: futureDate })
      );

      await expect(vaultService.unlockVault('user-1', 'vault-1')).rejects.toThrow('Vault is still locked');
    });
  });

  describe('closeVault', () => {
    it('should close a vault with zero balance', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ currentAmount: '0' }));
      mockVaultRepository.update.mockResolvedValue(createMockVault({ status: VaultStatus.CLOSED }));
      mockVaultEventRepository.create.mockResolvedValue({});

      const result = await vaultService.closeVault('user-1', 'vault-1');
      expect(result.status).toBe(VaultStatus.CLOSED);
    });

    it('should reject closing a vault with non-zero balance', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault({ currentAmount: '100' }));

      await expect(vaultService.closeVault('user-1', 'vault-1')).rejects.toThrow(
        'Cannot close vault with a non-zero balance'
      );
    });
  });

  describe('getVaultHistory', () => {
    it('should return paginated history for a vault', async () => {
      mockVaultRepository.findById.mockResolvedValue(createMockVault());
      mockVaultTransactionRepository.findByVaultId.mockResolvedValue([createMockVaultTransaction()]);
      mockVaultTransactionRepository.countByVaultId.mockResolvedValue(1);

      const result = await vaultService.getVaultHistory('user-1', 'vault-1', { page: 1, limit: 20 });

      expect(result.transactions).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('reconcileVaultTransaction', () => {
    it('should confirm a transaction when on-chain event is confirmed', async () => {
      const tx = createMockVaultTransaction();
      mockVaultTransactionRepository.findById.mockResolvedValue(tx);
      mockVaultEventRepository.findByVaultId.mockResolvedValue([
        createMockVaultEvent({ status: 'CONFIRMED', transactionHash: 'hash-1' }),
      ]);
      mockVaultTransactionRepository.updateStatus.mockResolvedValue(tx);

      await vaultService.reconcileVaultTransaction('vault-txn-1');

      expect(mockVaultRepository.addBalance).toHaveBeenCalledWith('vault-1', '100');
      expect(mockVaultTransactionRepository.updateStatus).toHaveBeenCalledWith(
        'vault-txn-1',
        VaultTransactionStatus.CONFIRMED,
        expect.objectContaining({ stellarTransactionHash: 'hash-1' })
      );
    });

    it('should mark transaction as failed when on-chain event failed', async () => {
      const tx = createMockVaultTransaction();
      mockVaultTransactionRepository.findById.mockResolvedValue(tx);
      mockVaultEventRepository.findByVaultId.mockResolvedValue([
        createMockVaultEvent({ status: 'FAILED', failureCode: 'NETWORK_ERROR', failureReason: 'Failed on chain' }),
      ]);
      mockVaultTransactionRepository.updateStatus.mockResolvedValue(tx);

      await vaultService.reconcileVaultTransaction('vault-txn-1');

      expect(mockVaultRepository.addBalance).not.toHaveBeenCalled();
      expect(mockVaultTransactionRepository.updateStatus).toHaveBeenCalledWith(
        'vault-txn-1',
        VaultTransactionStatus.FAILED,
        expect.objectContaining({ failureCode: 'NETWORK_ERROR' })
      );
    });
  });
});

const createMockVaultEvent = (overrides?: any) => ({
  id: 'vault-event-1',
  vaultId: 'vault-1',
  userId: 'user-1',
  eventType: 'DEPOSIT',
  status: 'REQUESTED',
  transactionHash: null,
  ledger: null,
  failureCode: null,
  failureReason: null,
  attempts: 0,
  payload: null,
  requestedAt: new Date(),
  submittedAt: null,
  confirmedAt: null,
  failedAt: null,
  updatedAt: new Date(),
  ...overrides,
});
