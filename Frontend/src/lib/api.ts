// Backend API client
// Handles communication with the backend API for fiat flows (NGN deposit/withdrawal)
// All fiat operations go through the backend, never directly to anchor

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api'

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
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  // Fiat deposit via backend (NGN -> Stellar)
  async initiateDeposit(amount: number, bankAccountId: string): Promise<{
    depositId: string
    status: string
    paymentInstructions: any
  }> {
    return this.request('/deposits/initiate', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId }),
    })
  }
  
  // Fiat withdrawal via backend (Stellar -> NGN)
  async initiateWithdrawal(amount: number, bankAccountId: string): Promise<{
    withdrawalId: string
    status: string
  }> {
    return this.request('/withdrawals/initiate', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId }),
    })
  }
  
  // Get deposit status
  async getDepositStatus(depositId: string): Promise<{
    status: string
    amount: number
    completedAt?: string
  }> {
    return this.request(`/deposits/${depositId}/status`)
  }
  
  // Get withdrawal status
  async getWithdrawalStatus(withdrawalId: string): Promise<{
    status: string
    amount: number
    completedAt?: string
  }> {
    return this.request(`/withdrawals/${withdrawalId}/status`)
  }
}

export const apiClient = new ApiClient()
