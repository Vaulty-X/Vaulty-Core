import * as StellarSdk from 'stellar-sdk';
import { transactionRepository, SUBMISSION_STATUS } from '../repositories/transaction.repository';
import { stellarClient } from '../blockchain/stellar/client';
import { AppError } from '../utils/AppError';
import { getTransactionQueue } from '../queues';
import type { SubmitTransactionInput } from '../validators/transaction.validator';

// Operations the platform is permitted to broadcast on behalf of users.
// Anything outside this set is rejected before submission.
const ALLOWED_OPERATION_TYPES = new Set<string>([
  'payment',
  'createAccount',
  'pathPaymentStrictReceive',
  'pathPaymentStrictSend',
  'changeTrust',
  'allowTrust',
  'setOptions',
  'manageData',
  'manageSellOffer',
  'manageBuyOffer',
  'createPassiveSellOffer',
  'accountMerge',
  'bumpSequence',
]);

const MAX_SUBMISSION_ATTEMPTS = 5;

const generateApiTransactionId = (): string =>
  `txn_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

export class TransactionService {
  /**
   * Decode, validate, and record a signed Stellar transaction, then attempt
   * to submit it. Persists an immutable StellarSubmission and returns a stable
   * API transaction id rather than a raw Horizon response.
   */
  async submit(userId: string, input: SubmitTransactionInput) {
    const { signedXdr, idempotencyKey, vaultId, paymentId } = input;

    // 1. Idempotency: reject duplicate keys for the same user immediately.
    const existing = await transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError('Idempotency key belongs to another user', 403);
      }
      return this.toPublicRecord(existing);
    }

    // 2. Decode + validate the XDR before doing anything else.
    let transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;
    try {
      transaction = stellarClient.decodeTransaction(signedXdr);
    } catch {
      await this.recordRejected(userId, input, 'INVALID_XDR', 'Malformed transaction XDR');
      throw new AppError('Malformed transaction XDR', 400);
    }

    // 3. Network guard: the envelope must target the configured network.
    const configuredPassphrase = stellarClient.getNetworkPassphrase();
    if (transaction.networkPassphrase !== configuredPassphrase) {
      await this.recordRejected(
        userId,
        input,
        'WRONG_NETWORK',
        'Transaction is signed for a different network'
      );
      throw new AppError('Transaction is signed for a different network', 400);
    }

    // 4. Operation allowlist: reject unsupported operation types.
    if (!this.hasAllowedOperations(transaction)) {
      await this.recordRejected(
        userId,
        input,
        'UNSUPPORTED_OPERATION',
        'Transaction contains unsupported operations'
      );
      throw new AppError('Transaction contains unsupported operations', 400);
    }

    // 5. Persist an immutable REQUESTED record, then submit.
    const record = await transactionRepository.create({
      apiTransactionId: generateApiTransactionId(),
      userId,
      idempotencyKey,
      status: SUBMISSION_STATUS.REQUESTED,
      signedXdr,
      networkPassphrase: configuredPassphrase,
      vaultId: vaultId ?? null,
      paymentId: paymentId ?? null,
    });

    try {
      const result = await stellarClient.submitTransaction(signedXdr);

      const updated = await transactionRepository.update(record.apiTransactionId, {
        status: SUBMISSION_STATUS.SUBMITTED,
        stellarTxHash: result.hash,
        ledger: result.ledger,
        submittedAt: new Date(),
      });

      // Hand off to the reconciliation worker for confirmation.
      await this.enqueueReconciliation(record.apiTransactionId, false);

      return this.toPublicRecord(updated);
    } catch (error: any) {
      const { failureCode, failureReason } = this.classifySubmissionError(error);
      await transactionRepository.update(record.apiTransactionId, {
        status: SUBMISSION_STATUS.REJECTED,
        failureCode,
        failureReason,
        rejectedAt: new Date(),
      });
      throw new AppError(failureReason ?? 'Transaction rejected', 400);
    }
  }

  /**
   * Confirmation/reconciliation step. Polls Horizon for the on-chain status of
   * a submitted transaction and retries failed-but-recoverable states up to a
   * bounded number of attempts.
   */
  async reconcile(apiTransactionId: string): Promise<void> {
    const record = await transactionRepository.findById(apiTransactionId);
    if (!record) {
      return;
    }

    if (record.status === SUBMISSION_STATUS.CONFIRMED) {
      return;
    }
    if (
      record.status === SUBMISSION_STATUS.FAILED ||
      record.status === SUBMISSION_STATUS.REJECTED
    ) {
      return;
    }

    const attempts = record.attempts + 1;
    const hash = record.stellarTxHash;

    // Out of retry budget: stop reconciling and record a terminal failure.
    const giveUp = async (failureCode: string, failureReason: string) => {
      await transactionRepository.update(apiTransactionId, {
        attempts,
        status: SUBMISSION_STATUS.FAILED,
        failureCode,
        failureReason,
        failedAt: new Date(),
      });
    };

    // Requeue for another polling pass while budget remains.
    const requeue = async () => {
      await transactionRepository.update(apiTransactionId, {
        attempts,
        status: SUBMISSION_STATUS.SUBMITTED,
      });
      await this.enqueueReconciliation(apiTransactionId, true);
    };

    if (!hash) {
      // Never received a hash (e.g. a REQUESTED record that slipped through).
      if (attempts >= MAX_SUBMISSION_ATTEMPTS) {
        await giveUp('NO_TRANSACTION_HASH', 'Transaction was never broadcast to the network');
        return;
      }
      await requeue();
      return;
    }

    let onChain: any;
    try {
      onChain = await stellarClient.getTransaction(hash);
    } catch {
      if (attempts >= MAX_SUBMISSION_ATTEMPTS) {
        await giveUp(
          'RECONCILIATION_TIMEOUT',
          'Confirmation could not be verified within the retry window'
        );
        return;
      }
      await requeue();
      return;
    }

    if (onChain && onChain.successful) {
      await transactionRepository.update(apiTransactionId, {
        attempts,
        status: SUBMISSION_STATUS.CONFIRMED,
        ledger: onChain.ledger ?? record.ledger,
        confirmedAt: new Date(),
      });
      return;
    }

    if (onChain && onChain.successful === false) {
      await transactionRepository.update(apiTransactionId, {
        attempts,
        status: SUBMISSION_STATUS.FAILED,
        failureCode: 'TRANSACTION_FAILED',
        failureReason: 'Transaction was rejected by the network',
        failedAt: new Date(),
      });
      return;
    }

    // Transaction exists but is not yet confirmed (still in a ledger queue).
    if (attempts >= MAX_SUBMISSION_ATTEMPTS) {
      await giveUp(
        'RECONCILIATION_TIMEOUT',
        'Confirmation could not be verified within the retry window'
      );
      return;
    }
    await requeue();
  }

  async getStatus(apiTransactionId: string, userId: string) {
    const record = await transactionRepository.findById(apiTransactionId);
    if (!record) {
      throw new AppError('Transaction not found', 404);
    }
    if (record.userId !== userId) {
      throw new AppError('Transaction not found', 404);
    }
    return this.toPublicRecord(record);
  }

  private hasAllowedOperations(
    transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction
  ): boolean {
    const inner: any =
      'innerTransaction' in transaction && transaction.innerTransaction
        ? transaction.innerTransaction
        : transaction;
    const operations = inner.operations ?? [];
    return operations.every((op: any) => ALLOWED_OPERATION_TYPES.has(op.type));
  }

  private classifySubmissionError(error: any): { failureCode: string; failureReason: string } {
    if (error?.message === 'NETWORK_MISMATCH') {
      return {
        failureCode: 'WRONG_NETWORK',
        failureReason: 'Transaction targets the wrong network',
      };
    }
    if (error?.message === 'SUBMISSION_REJECTED') {
      const codes = error.resultCodes;
      return {
        failureCode: 'REJECTED_BY_NETWORK',
        failureReason: `Transaction rejected by network (${JSON.stringify(codes ?? {})})`,
      };
    }
    return {
      failureCode: 'SUBMISSION_FAILED',
      failureReason: 'Transaction submission failed',
    };
  }

  private async recordRejected(
    userId: string,
    input: SubmitTransactionInput,
    failureCode: string,
    failureReason: string
  ) {
    await transactionRepository.create({
      apiTransactionId: generateApiTransactionId(),
      userId,
      idempotencyKey: input.idempotencyKey,
      status: SUBMISSION_STATUS.REJECTED,
      signedXdr: input.signedXdr,
      networkPassphrase: stellarClient.getNetworkPassphrase(),
      vaultId: input.vaultId ?? null,
      paymentId: input.paymentId ?? null,
      failureCode,
      failureReason,
      rejectedAt: new Date(),
    });
  }

  private enqueueReconciliation(apiTransactionId: string, delay: boolean) {
    const queue = getTransactionQueue();
    return queue.add(
      'stellar-confirm',
      { apiTransactionId },
      {
        attempts: MAX_SUBMISSION_ATTEMPTS,
        backoff: { type: 'exponential', delay: delay ? 5000 : 1000 },
        delay: delay ? 2000 : 0,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  private toPublicRecord(record: any) {
    return {
      apiTransactionId: record.apiTransactionId,
      status: record.status,
      stellarTxHash: record.stellarTxHash ?? null,
      ledger: record.ledger ?? null,
      vaultId: record.vaultId ?? null,
      paymentId: record.paymentId ?? null,
      failureCode: record.failureCode ?? null,
      failureReason: record.failureReason ?? null,
      attempts: record.attempts,
      requestedAt: record.requestedAt,
      submittedAt: record.submittedAt,
      confirmedAt: record.confirmedAt,
      failedAt: record.failedAt,
      rejectedAt: record.rejectedAt,
    };
  }
}

export const transactionService = new TransactionService();
