import crypto from 'crypto';
import { config } from '../config';

export interface ProviderInstruction {
  accountName: string;
  bankName: string;
  accountNumber: string;
  reference: string;
  amount: string;
  currency: string;
  expiresAt: string;
}

export interface ProviderWebhookPayload {
  event: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  transactionHash?: string;
  failureReason?: string;
  timestamp: string;
}

export class AnchorService {
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = config.anchor.webhookSecret;
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  async requestDepositInstruction(
    _userId: string,
    _amount: string,
    _bankAccount: string,
    _accountName: string,
    _narration?: string
  ): Promise<ProviderInstruction> {
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      accountName: 'Vaulty Collections',
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      reference,
      amount: _amount,
      currency: 'NGN',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async requestWithdrawalInstruction(
    _userId: string,
    _amount: string,
    _bankAccount: string,
    _accountName: string
  ): Promise<ProviderInstruction> {
    const reference = `WTH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      accountName: _accountName,
      bankName: 'Test Bank',
      accountNumber: _bankAccount,
      reference,
      amount: _amount,
      currency: 'NGN',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async pollProviderStatus(providerReference: string): Promise<ProviderWebhookPayload> {
    return {
      event: 'payment.status_updated',
      reference: providerReference,
      amount: '0',
      currency: 'NGN',
      status: 'PENDING',
      timestamp: new Date().toISOString(),
    };
  }

  mapProviderStatusToInternal(providerStatus: string): string {
    switch (providerStatus) {
      case 'SUCCESS':
        return 'COMPLETED';
      case 'FAILED':
        return 'FAILED';
      case 'REVERSED':
        return 'REVERSED';
      case 'PENDING':
        return 'PENDING';
      default:
        return 'PENDING';
    }
  }

  isTerminalStatus(status: string): boolean {
    return (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'REVERSED' ||
      status === 'CANCELLED'
    );
  }
}

export const anchorService = new AnchorService();
