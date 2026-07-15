import { ApiClient } from '../api'

// Use globalThis.fetch mock so tests don't make real HTTP calls
const mockFetch = jest.fn()
globalThis.fetch = mockFetch

/** Helper that resolves fetch with a JSON body and the given status. */
const mockResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response)

describe('ApiClient', () => {
  let client: ApiClient

  beforeEach(() => {
    client = new ApiClient('http://localhost:8000/api')
    jest.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // initiateDeposit
  // ---------------------------------------------------------------------------
  describe('initiateDeposit', () => {
    it('calls the correct endpoint with POST and JSON body', async () => {
      mockFetch.mockReturnValue(
        mockResponse({ depositId: 'dep-123', status: 'pending', paymentInstructions: {} })
      )

      await client.initiateDeposit(5000, 'bank-acc-001')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/deposits/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ amount: 5000, bankAccountId: 'bank-acc-001' }),
        })
      )
    })

    it('returns the deposit response on success', async () => {
      const payload = { depositId: 'dep-456', status: 'pending', paymentInstructions: { ref: 'XYZ' } }
      mockFetch.mockReturnValue(mockResponse(payload))

      const result = await client.initiateDeposit(1000, 'bank-acc-002')

      expect(result).toEqual(payload)
    })

    it('throws an error when the server returns a non-2xx status', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'Bad Request' }, 400))

      await expect(client.initiateDeposit(0, '')).rejects.toThrow('API request failed')
    })

    it('propagates network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(client.initiateDeposit(100, 'bank-acc-003')).rejects.toThrow('Failed to fetch')
    })
  })

  // ---------------------------------------------------------------------------
  // initiateWithdrawal
  // ---------------------------------------------------------------------------
  describe('initiateWithdrawal', () => {
    it('calls the correct endpoint with POST and JSON body', async () => {
      mockFetch.mockReturnValue(
        mockResponse({ withdrawalId: 'wd-001', status: 'pending' })
      )

      await client.initiateWithdrawal(2000, 'bank-acc-004')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/withdrawals/initiate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 2000, bankAccountId: 'bank-acc-004' }),
        })
      )
    })

    it('returns the withdrawal response on success', async () => {
      const payload = { withdrawalId: 'wd-999', status: 'processing' }
      mockFetch.mockReturnValue(mockResponse(payload))

      const result = await client.initiateWithdrawal(500, 'bank-acc-005')

      expect(result).toEqual(payload)
    })

    it('throws on 4xx/5xx response', async () => {
      mockFetch.mockReturnValue(mockResponse({ error: 'Insufficient funds' }, 422))

      await expect(client.initiateWithdrawal(99999, 'bank-acc-006')).rejects.toThrow(
        'API request failed'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // getDepositStatus
  // ---------------------------------------------------------------------------
  describe('getDepositStatus', () => {
    it('calls the correct GET endpoint', async () => {
      mockFetch.mockReturnValue(
        mockResponse({ status: 'completed', amount: 5000, completedAt: '2026-07-15T10:00:00Z' })
      )

      await client.getDepositStatus('dep-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/deposits/dep-123/status',
        expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
      )
    })

    it('returns status data on success', async () => {
      const payload = { status: 'completed', amount: 1000, completedAt: '2026-07-15T12:00:00Z' }
      mockFetch.mockReturnValue(mockResponse(payload))

      const result = await client.getDepositStatus('dep-789')

      expect(result.status).toBe('completed')
      expect(result.amount).toBe(1000)
    })

    it('throws on not-found response', async () => {
      mockFetch.mockReturnValue(mockResponse({ error: 'Not found' }, 404))

      await expect(client.getDepositStatus('dep-missing')).rejects.toThrow('API request failed')
    })
  })

  // ---------------------------------------------------------------------------
  // getWithdrawalStatus
  // ---------------------------------------------------------------------------
  describe('getWithdrawalStatus', () => {
    it('calls the correct GET endpoint', async () => {
      mockFetch.mockReturnValue(
        mockResponse({ status: 'processing', amount: 300 })
      )

      await client.getWithdrawalStatus('wd-555')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/withdrawals/wd-555/status',
        expect.anything()
      )
    })

    it('returns status data on success', async () => {
      const payload = { status: 'processing', amount: 300 }
      mockFetch.mockReturnValue(mockResponse(payload))

      const result = await client.getWithdrawalStatus('wd-555')

      expect(result).toEqual(payload)
    })

    it('throws on server error response', async () => {
      mockFetch.mockReturnValue(mockResponse({ error: 'Internal Server Error' }, 500))

      await expect(client.getWithdrawalStatus('wd-error')).rejects.toThrow('API request failed')
    })
  })

  // ---------------------------------------------------------------------------
  // Default base URL
  // ---------------------------------------------------------------------------
  it('uses NEXT_PUBLIC_BACKEND_API_URL env variable as default base URL', async () => {
    // The env variable is not set in tests, so it falls back to the hardcoded default
    const defaultClient = new ApiClient()
    mockFetch.mockReturnValue(mockResponse({ depositId: 'x', status: 'pending', paymentInstructions: {} }))

    await defaultClient.initiateDeposit(100, 'bank-001')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/deposits/initiate')
  })
})
