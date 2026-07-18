import { paymentService } from '../../src/services/payment.service';
import { AppError } from '../../src/utils/AppError';

jest.mock('../../src/repositories/payment.repository');
jest.mock('../../src/repositories/payment-audit.repository');

const mockPaymentRepository = require('../../src/repositories/payment.repository').paymentRepository;
const mockAuditRepository = require('../../src/repositories/payment-audit.repository').paymentAuditLogRepository;

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
jest.mock('../../src/queues', () => ({
  getPaymentQueue: jest.fn(() => ({
    add: mockQueueAdd,
  })),
}));

const createMockPayment = (overrides?: any) => ({
  id: 'payment-1',
  userId: 'user-1',
  direction: 'DEPOSIT',
  status: 'INITIATED',
  amount: '1000',
  asset: 'NGN',
  fee: '0',
  providerReference: null,
  idempotencyKey: 'idempotency-1',
  method: 'BANK_TRANSFER',
  provider: 'ANCHOR',
  bankAccount: '1234567890',
  accountName: 'John Doe',
  narration: 'Test deposit',
  failureReason: null,
  stellarTransactionHash: null,
  reference: 'DEP-123',
  metadata: null,
  initiatedAt: null,
  instructionsSentAt: null,
  confirmedAt: null,
  settledAt: null,
  failedAt: null,
  reversedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeposit', () => {
    it('should create a new deposit payment', async () => {
      mockPaymentRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPaymentRepository.create.mockResolvedValue(createMockPayment());
      mockAuditRepository.create.mockResolvedValue({});

      const result = await paymentService.initiateDeposit('user-1', {
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-1',
      });

      expect(result).toBeDefined();
      expect(mockPaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          direction: 'DEPOSIT',
          idempotencyKey: 'idempotency-1',
        })
      );
    });

    it('should return existing payment for duplicate idempotency key', async () => {
      const existing = createMockPayment();
      mockPaymentRepository.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await paymentService.initiateDeposit('user-1', {
        amount: '1000',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-1',
      });

      expect(result).toBe(existing);
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate idempotency key for different user', async () => {
      const existing = createMockPayment({ userId: 'user-2' });
      mockPaymentRepository.findByIdempotencyKey.mockResolvedValue(existing);

      await expect(
        paymentService.initiateDeposit('user-1', {
          amount: '1000',
          asset: 'NGN',
          method: 'BANK_TRANSFER',
          bankAccount: '1234567890',
          accountName: 'John Doe',
          idempotencyKey: 'idempotency-1',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('initiateWithdrawal', () => {
    it('should create a new withdrawal payment', async () => {
      mockPaymentRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPaymentRepository.create.mockResolvedValue(createMockPayment({ direction: 'WITHDRAWAL' }));
      mockAuditRepository.create.mockResolvedValue({});

      const result = await paymentService.initiateWithdrawal('user-1', {
        amount: '500',
        asset: 'NGN',
        method: 'BANK_TRANSFER',
        bankAccount: '1234567890',
        accountName: 'John Doe',
        idempotencyKey: 'idempotency-2',
      });

      expect(result).toBeDefined();
      expect(mockPaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          direction: 'WITHDRAWAL',
        })
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment for authorized user', async () => {
      const payment = createMockPayment();
      mockPaymentRepository.findById.mockResolvedValue(payment);

      const result = await paymentService.getPaymentStatus('user-1', 'payment-1');
      expect(result).toBe(payment);
    });

    it('should throw 404 for non-existent payment', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(paymentService.getPaymentStatus('user-1', 'payment-1')).rejects.toThrow(
        AppError
      );
    });

    it('should throw 404 for unauthorized user', async () => {
      const payment = createMockPayment({ userId: 'user-2' });
      mockPaymentRepository.findById.mockResolvedValue(payment);

      await expect(paymentService.getPaymentStatus('user-1', 'payment-1')).rejects.toThrow(
        AppError
      );
    });
  });

  describe('cancelPayment', () => {
    it('should cancel an initiated payment', async () => {
      const payment = createMockPayment();
      mockPaymentRepository.findById.mockResolvedValue(payment);
      mockPaymentRepository.update.mockResolvedValue({ ...payment, status: 'CANCELLED' });

      await paymentService.cancelPayment('payment-1', 'user-1');
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(
        'payment-1',
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });

    it('should reject invalid state transitions', async () => {
      const payment = createMockPayment({ status: 'COMPLETED' });
      mockPaymentRepository.findById.mockResolvedValue(payment);

      await expect(paymentService.cancelPayment('payment-1', 'user-1')).rejects.toThrow(AppError);
    });
  });

  describe('retryPayment', () => {
    it('should retry a failed payment', async () => {
      const payment = createMockPayment({ status: 'FAILED' });
      mockPaymentRepository.findById.mockResolvedValue(payment);
      mockPaymentRepository.update.mockResolvedValue({ ...payment, status: 'PENDING' });

      await paymentService.retryPayment('payment-1');
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(
        'payment-1',
        expect.objectContaining({ status: 'PENDING' })
      );
    });

    it('should reject invalid state transitions', async () => {
      const payment = createMockPayment({ status: 'COMPLETED' });
      mockPaymentRepository.findById.mockResolvedValue(payment);

      await expect(paymentService.retryPayment('payment-1')).rejects.toThrow(AppError);
    });
  });

  describe('processProviderWebhook', () => {
    it('should update payment status from provider webhook', async () => {
      const payment = createMockPayment({ providerReference: 'REF-123' });
      mockPaymentRepository.findByProviderReference.mockResolvedValue(payment);
      mockPaymentRepository.update.mockResolvedValue({ ...payment, status: 'COMPLETED' });

      const result = await paymentService.processProviderWebhook({
        event: 'payment.completed',
        reference: 'REF-123',
        status: 'SUCCESS',
        amount: '1000',
        currency: 'NGN',
        timestamp: new Date().toISOString(),
      });

      expect(result.processed).toBe(true);
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(
        'payment-1',
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });

    it('should ignore duplicate webhooks for terminal states', async () => {
      const payment = createMockPayment({ status: 'COMPLETED', providerReference: 'REF-123' });
      mockPaymentRepository.findByProviderReference.mockResolvedValue(payment);

      const result = await paymentService.processProviderWebhook({
        event: 'payment.completed',
        reference: 'REF-123',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('Terminal state');
    });

    it('should return not found for unknown reference', async () => {
      mockPaymentRepository.findByProviderReference.mockResolvedValue(null);

      const result = await paymentService.processProviderWebhook({
        event: 'payment.completed',
        reference: 'UNKNOWN',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('Payment not found');
    });
  });
});
