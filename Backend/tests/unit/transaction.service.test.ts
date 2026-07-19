import { transactionService } from '../../src/services/transaction.service';
import { AppError } from '../../src/utils/AppError';
import { SUBMISSION_STATUS } from '../../src/repositories/transaction.repository';

jest.mock('../../src/repositories/transaction.repository');
jest.mock('../../src/queues', () => ({
  getTransactionQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) })),
}));

const mockRepository = require('../../src/repositories/transaction.repository')
  .transactionRepository;

const mockClient = require('../../src/blockchain/stellar/client').stellarClient;

const VALID_XDR =
  'AAAAAgAAAAC' + 'A'.repeat(200);

const baseInput = {
  signedXdr: VALID_XDR,
  idempotencyKey: 'idem-1',
};

describe('TransactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.findById.mockImplementation((id: string) =>
      Promise.resolve({ apiTransactionId: id, userId: 'user-1', status: SUBMISSION_STATUS.SUBMITTED })
    );
    mockClient.getNetworkPassphrase = jest.fn().mockReturnValue('Test SDF Network ; September 2015');
    // Default: a decoded, correctly-networked, payment-only transaction.
    mockClient.decodeTransaction = jest.fn().mockReturnValue({
      networkPassphrase: 'Test SDF Network ; September 2015',
      operations: [{ type: 'payment' }],
    });
    mockClient.submitTransaction = jest.fn().mockResolvedValue({
      hash: 'txhash123',
      ledger: 42,
      success: true,
    });
    mockClient.getTransaction = jest.fn().mockResolvedValue({ successful: true, ledger: 43 });
  });

  describe('submit', () => {
    it('rejects duplicate idempotency keys for the same user', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue({
        userId: 'user-1',
        apiTransactionId: 'txn-existing',
        status: SUBMISSION_STATUS.SUBMITTED,
      });

      const result = await transactionService.submit('user-1', baseInput);
      expect(result.apiTransactionId).toBe('txn-existing');
      expect(mockClient.submitTransaction).not.toHaveBeenCalled();
    });

    it('rejects duplicate idempotency keys from another user', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue({
        userId: 'user-2',
        apiTransactionId: 'txn-other',
      });

      await expect(transactionService.submit('user-1', baseInput)).rejects.toThrow(AppError);
    });

    it('rejects malformed XDR', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockClient.decodeTransaction.mockImplementation(() => {
        throw new Error('bad xdr');
      });

      await expect(transactionService.submit('user-1', baseInput)).rejects.toThrow(
        'Malformed transaction XDR'
      );
      expect(mockClient.submitTransaction).not.toHaveBeenCalled();
    });

    it('rejects wrong-network transactions', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockClient.decodeTransaction.mockReturnValue({
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
        operations: [{ type: 'payment' }],
      });

      await expect(transactionService.submit('user-1', baseInput)).rejects.toThrow(
        'different network'
      );
    });

    it('rejects unsupported operations', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockClient.decodeTransaction.mockReturnValue({
        networkPassphrase: 'Test SDF Network ; September 2015',
        operations: [{ type: 'payment' }, { type: 'inflation' }],
      });

      await expect(transactionService.submit('user-1', baseInput)).rejects.toThrow(
        'unsupported operations'
      );
      expect(mockClient.submitTransaction).not.toHaveBeenCalled();
    });

    it('submits valid transactions and returns a stable API id', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        apiTransactionId: 'txn-new',
        userId: 'user-1',
        status: SUBMISSION_STATUS.REQUESTED,
      });
      mockRepository.update.mockImplementation((_id: string, data: any) =>
        Promise.resolve({ apiTransactionId: 'txn-new', userId: 'user-1', ...data })
      );

      const result = await transactionService.submit('user-1', baseInput);
      expect(mockClient.submitTransaction).toHaveBeenCalledWith(VALID_XDR);
      expect(result.status).toBe(SUBMISSION_STATUS.SUBMITTED);
      expect(result.stellarTxHash).toBe('txhash123');
    });

    it('records rejected state when submission fails', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        apiTransactionId: 'txn-new',
        userId: 'user-1',
        status: SUBMISSION_STATUS.REQUESTED,
      });
      mockClient.submitTransaction.mockRejectedValue(new Error('SUBMISSION_REJECTED'));

      await expect(transactionService.submit('user-1', baseInput)).rejects.toThrow(AppError);
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-new',
        expect.objectContaining({ status: SUBMISSION_STATUS.REJECTED })
      );
    });
  });

  describe('reconcile', () => {
    const record = (overrides?: any) => ({
      apiTransactionId: 'txn-1',
      userId: 'user-1',
      status: SUBMISSION_STATUS.SUBMITTED,
      stellarTxHash: 'hash-1',
      ledger: 42,
      attempts: 0,
      ...overrides,
    });

    it('marks a confirmed transaction as CONFIRMED', async () => {
      mockRepository.findById.mockResolvedValue(record());
      mockClient.getTransaction.mockResolvedValue({ successful: true, ledger: 99 });

      await transactionService.reconcile('txn-1');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ status: SUBMISSION_STATUS.CONFIRMED, ledger: 99 })
      );
    });

    it('marks a failed on-chain transaction as FAILED', async () => {
      mockRepository.findById.mockResolvedValue(record());
      mockClient.getTransaction.mockResolvedValue({ successful: false });

      await transactionService.reconcile('txn-1');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ status: SUBMISSION_STATUS.FAILED })
      );
    });

    it('retries when confirmation is delayed', async () => {
      mockRepository.findById.mockResolvedValue(record({ attempts: 0 }));
      mockClient.getTransaction.mockResolvedValue({ successful: undefined });

      await transactionService.reconcile('txn-1');
      // attempt incremented but still SUBMITTED, and a new job was enqueued.
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ attempts: 1, status: SUBMISSION_STATUS.SUBMITTED })
      );
    });

    it('fails permanently after exceeding the retry budget', async () => {
      mockRepository.findById.mockResolvedValue(record({ attempts: 5 }));
      mockClient.getTransaction.mockResolvedValue({ successful: undefined });

      await transactionService.reconcile('txn-1');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ status: SUBMISSION_STATUS.FAILED, failureCode: 'RECONCILIATION_TIMEOUT' })
      );
    });

    it('retries on polling errors while budget remains', async () => {
      mockRepository.findById.mockResolvedValue(record({ attempts: 1 }));
      mockClient.getTransaction.mockRejectedValue(new Error('network error'));

      await transactionService.reconcile('txn-1');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ attempts: 2, status: SUBMISSION_STATUS.SUBMITTED })
      );
    });
  });
});
