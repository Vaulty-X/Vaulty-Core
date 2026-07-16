import {
  PaymentInstructions,
  FeeInfo,
  ConversionInfo,
  PaymentStatus,
} from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      throw new ApiError(
        body?.message || `API request failed: ${response.statusText}`,
        response.status,
        body
      )
    }

    return body as T
  }

  async initiateDeposit(
    amount: number,
    bankAccountId: string,
    idempotencyKey: string
  ): Promise<{
    depositId: string
    status: PaymentStatus
    paymentInstructions: PaymentInstructions
    fees: FeeInfo
    conversion: ConversionInfo
  }> {
    return this.request('/deposits/initiate', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId, idempotencyKey }),
    })
  }

  async initiateWithdrawal(
    amount: number,
    bankAccountId: string,
    idempotencyKey: string
  ): Promise<{
    withdrawalId: string
    status: PaymentStatus
    fees: FeeInfo
    conversion: ConversionInfo
  }> {
    return this.request('/withdrawals/initiate', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId, idempotencyKey }),
    })
  }

  async getDepositStatus(depositId: string): Promise<{
    status: PaymentStatus
    amount: number
    fees: FeeInfo
    conversion: ConversionInfo
    failureReason?: string
    completedAt?: string
  }> {
    return this.request(`/deposits/${depositId}/status`)
  }

  async getWithdrawalStatus(withdrawalId: string): Promise<{
    status: PaymentStatus
    amount: number
    fees: FeeInfo
    conversion: ConversionInfo
    failureReason?: string
    completedAt?: string
  }> {
    return this.request(`/withdrawals/${withdrawalId}/status`)
  }

  async retryDeposit(depositId: string): Promise<{
    status: PaymentStatus
    paymentInstructions: PaymentInstructions
  }> {
    return this.request(`/deposits/${depositId}/retry`, {
      method: 'POST',
    })
  }

  async retryWithdrawal(withdrawalId: string): Promise<{
    status: PaymentStatus
  }> {
    return this.request(`/withdrawals/${withdrawalId}/retry`, {
      method: 'POST',
    })
  }
}

export const apiClient = new ApiClient()
