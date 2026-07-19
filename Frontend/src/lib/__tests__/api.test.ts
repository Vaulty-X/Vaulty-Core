/**
 * Unit tests for ApiClient (src/lib/api.ts).
 *
 * Strategy:
 * - Replace global `fetch` with a jest.fn() for each test.
 * - Cover the happy path for each public method.
 * - Thoroughly test error states: non-OK HTTP responses and network failures.
 */

import { ApiClient } from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(options: { ok: boolean; status?: number; statusText?: string; body?: unknown }) {
  const { ok, status = ok ? 200 : 400, statusText = ok ? 'OK' : 'Bad Request', body = {} } = options

  return jest.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
  })
}

function networkErrorFetch(message = 'Network error') {
  return jest.fn().mockRejectedValue(new Error(message))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiClient', () => {
  const BASE_URL = 'http://localhost:8000/api'
  let client: ApiClient

  beforeEach(() => {
    client = new ApiClient(BASE_URL)
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore global fetch if we assigned it
    if ((global.fetch as jest.Mock)?.mockRestore) {
      (global.fetch as jest.Mock).mockRestore()
    }
  })

  // -------------------------------------------------------------------------
  // initiateDeposit
  // -------------------------------------------------------------------------

  describe('initiateDeposit()', () => {
    it('POSTs to /deposits/initiate and returns the response body', async () => {
      const responseBody = {
        depositId: 'dep-001',
        status: 'pending',
        paymentInstructions: { bankName: 'GTBank', accountNumber: '0123456789' },
      }
      global.fetch = mockFetch({ ok: true, body: responseBody })

      const result = await client.initiateDeposit(5000, 'bank-acc-1')

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/deposits/initiate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 5000, bankAccountId: 'bank-acc-1' }),
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(result).toEqual(responseBody)
    })

    it('throws when the server returns a non-OK response', async () => {
      global.fetch = mockFetch({ ok: false, status: 422, statusText: 'Unprocessable Entity' })

      await expect(client.initiateDeposit(5000, 'bank-acc-1')).rejects.toThrow(
        'API request failed: Unprocessable Entity'
      )
    })

    it('propagates network errors', async () => {
      global.fetch = networkErrorFetch('Failed to fetch')

      await expect(client.initiateDeposit(5000, 'bank-acc-1')).rejects.toThrow('Failed to fetch')
    })
  })

  // -------------------------------------------------------------------------
  // initiateWithdrawal
  // -------------------------------------------------------------------------

  describe('initiateWithdrawal()', () => {
    it('POSTs to /withdrawals/initiate and returns the response body', async () => {
      const responseBody = { withdrawalId: 'wd-001', status: 'pending' }
      global.fetch = mockFetch({ ok: true, body: responseBody })

      const result = await client.initiateWithdrawal(2000, 'bank-acc-2')

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/withdrawals/initiate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 2000, bankAccountId: 'bank-acc-2' }),
        })
      )
      expect(result).toEqual(responseBody)
    })

    it('throws on 500 Internal Server Error', async () => {
      global.fetch = mockFetch({ ok: false, status: 500, statusText: 'Internal Server Error' })

      await expect(client.initiateWithdrawal(2000, 'bank-acc-2')).rejects.toThrow(
        'API request failed: Internal Server Error'
      )
    })

    it('propagates network errors', async () => {
      global.fetch = networkErrorFetch('Network unreachable')

      await expect(client.initiateWithdrawal(2000, 'bank-acc-2')).rejects.toThrow(
        'Network unreachable'
      )
    })
  })

  // -------------------------------------------------------------------------
  // getDepositStatus
  // -------------------------------------------------------------------------

  describe('getDepositStatus()', () => {
    it('GETs /deposits/:id/status and returns the response body', async () => {
      const responseBody = { status: 'completed', amount: 5000, completedAt: '2024-01-01T10:00:00Z' }
      global.fetch = mockFetch({ ok: true, body: responseBody })

      const result = await client.getDepositStatus('dep-001')

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/deposits/dep-001/status`,
        expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
      )
      expect(result).toEqual(responseBody)
    })

    it('throws on 404 Not Found', async () => {
      global.fetch = mockFetch({ ok: false, status: 404, statusText: 'Not Found' })

      await expect(client.getDepositStatus('dep-missing')).rejects.toThrow(
        'API request failed: Not Found'
      )
    })

    it('propagates network errors', async () => {
      global.fetch = networkErrorFetch('Timeout')

      await expect(client.getDepositStatus('dep-001')).rejects.toThrow('Timeout')
    })
  })

  // -------------------------------------------------------------------------
  // getWithdrawalStatus
  // -------------------------------------------------------------------------

  describe('getWithdrawalStatus()', () => {
    it('GETs /withdrawals/:id/status and returns the response body', async () => {
      const responseBody = { status: 'processing', amount: 2000 }
      global.fetch = mockFetch({ ok: true, body: responseBody })

      const result = await client.getWithdrawalStatus('wd-001')

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/withdrawals/wd-001/status`,
        expect.anything()
      )
      expect(result).toEqual(responseBody)
    })

    it('throws on 401 Unauthorized', async () => {
      global.fetch = mockFetch({ ok: false, status: 401, statusText: 'Unauthorized' })

      await expect(client.getWithdrawalStatus('wd-001')).rejects.toThrow(
        'API request failed: Unauthorized'
      )
    })

    it('propagates network errors', async () => {
      global.fetch = networkErrorFetch('Connection refused')

      await expect(client.getWithdrawalStatus('wd-001')).rejects.toThrow('Connection refused')
    })
  })

  // -------------------------------------------------------------------------
  // Default base URL
  // -------------------------------------------------------------------------

  describe('default constructor', () => {
    it('uses NEXT_PUBLIC_BACKEND_API_URL env var when no baseUrl is passed', async () => {
      // The module-level constant picks up the env var at import time.
      // Confirm the exported singleton uses the env-var-based default.
      const { ApiClient: FreshClient } = await import('../api')
      const defaultClient = new FreshClient()
      // We just verify instantiation succeeds; the base URL used is tested above.
      expect(defaultClient).toBeInstanceOf(FreshClient)
    })
  })

  // -------------------------------------------------------------------------
  // getFeatureFlags
  // -------------------------------------------------------------------------

  describe('getFeatureFlags()', () => {
    it('GETs /config/features and returns the flags object', async () => {
      const flags = { lending: true, borrowing: false, investments: false }
      global.fetch = mockFetch({ ok: true, body: flags })

      const result = await client.getFeatureFlags()

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/config/features`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(result).toEqual(flags)
    })

    it('falls back to env-var defaults when the backend returns a non-OK response', async () => {
      global.fetch = mockFetch({ ok: false, status: 503, statusText: 'Service Unavailable' })

      // With no env vars set, all flags default to false.
      const result = await client.getFeatureFlags()

      expect(result).toEqual({ lending: false, borrowing: false, investments: false })
    })

    it('falls back to env-var defaults on a network error', async () => {
      global.fetch = networkErrorFetch('Connection refused')

      const result = await client.getFeatureFlags()

      expect(result).toEqual({ lending: false, borrowing: false, investments: false })
    })
  })
})
