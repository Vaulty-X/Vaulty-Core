/**
 * Unit tests for the useWallet hook.
 *
 * Strategy:
 * - Mock walletManager (src/lib/stellar) so tests don't need a real Stellar SDK.
 * - Mock the zustand store (src/stores) to spy on wallet state mutations.
 * - Verify happy-path connection, disconnection, and error-state handling.
 */

import { renderHook, act } from '@testing-library/react'
import { useWallet } from '../useWallet'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the whole stellar module; individual tests override resolve/reject
jest.mock('@/lib/stellar', () => {
  class WalletConnectionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'WalletConnectionError'
    }
  }

  return {
    walletManager: {
      connectWallet: jest.fn(),
      disconnectWallet: jest.fn(),
    },
    WalletConnectionError,
  }
})

// Mock the zustand store so we control wallet state
jest.mock('@/stores', () => ({
  useAppStore: jest.fn(),
}))

import { walletManager, WalletConnectionError } from '@/lib/stellar'
import { useAppStore } from '@/stores'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConnect = walletManager.connectWallet as jest.Mock
const mockDisconnect = walletManager.disconnectWallet as jest.Mock
const mockUseAppStore = useAppStore as unknown as jest.Mock

function buildStoreMock(overrides?: Partial<ReturnType<typeof buildStoreMock>>) {
  const setWalletConnected = jest.fn()
  const setWalletDisconnected = jest.fn()

  return {
    wallet: { isConnected: false, publicKey: null, network: 'testnet' as const },
    setWalletConnected,
    setWalletDisconnected,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initial state', () => {
    it('returns isConnecting=false and error=null before any action', () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())

      const { result } = renderHook(() => useWallet())

      expect(result.current.isConnecting).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.wallet.isConnected).toBe(false)
    })
  })

  describe('connect()', () => {
    it('calls walletManager.connectWallet and updates store on success', async () => {
      const storeMock = buildStoreMock()
      mockUseAppStore.mockReturnValue(storeMock)
      mockConnect.mockResolvedValue('GABCDEF1234567890')

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.connect()
      })

      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(storeMock.setWalletConnected).toHaveBeenCalledWith(
        'GABCDEF1234567890',
        'testnet'
      )
      expect(result.current.error).toBeNull()
      expect(result.current.isConnecting).toBe(false)
    })

    it('sets error state when walletManager.connectWallet throws an Error', async () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())
      mockConnect.mockRejectedValue(new Error('Wallet connection not yet implemented'))

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toBe('Wallet connection not yet implemented')
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.isWalletError).toBe(false)
    })

    it('flags isWalletError when walletManager.connectWallet throws a WalletConnectionError', async () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())
      mockConnect.mockRejectedValue(new WalletConnectionError('Wallet connection not yet implemented'))

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.isWalletError).toBe(true)
    })

    it('sets generic error message when a non-Error is thrown', async () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())
      mockConnect.mockRejectedValue('unexpected string error')

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toBe('Failed to connect wallet')
      expect(result.current.isWalletError).toBe(false)
    })

    it('sets isConnecting=true during the async call', async () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())

      let resolve: (v: string) => void
      mockConnect.mockReturnValue(
        new Promise<string>((res) => {
          resolve = res
        })
      )

      const { result } = renderHook(() => useWallet())

      // Start the connect call but don't await it yet
      act(() => {
        result.current.connect()
      })

      expect(result.current.isConnecting).toBe(true)

      // Resolve the wallet promise
      await act(async () => {
        resolve!('GPUBKEY')
      })

      expect(result.current.isConnecting).toBe(false)
    })
  })

  describe('disconnect()', () => {
    it('calls walletManager.disconnectWallet and clears store on success', async () => {
      const storeMock = buildStoreMock({
        wallet: { isConnected: true, publicKey: 'GABCDEF', network: 'testnet' },
      })
      mockUseAppStore.mockReturnValue(storeMock)
      mockDisconnect.mockResolvedValue(undefined)

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.disconnect()
      })

      expect(mockDisconnect).toHaveBeenCalledTimes(1)
      expect(storeMock.setWalletDisconnected).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBeNull()
    })

    it('sets error state when walletManager.disconnectWallet throws', async () => {
      mockUseAppStore.mockReturnValue(buildStoreMock())
      mockDisconnect.mockRejectedValue(new Error('Disconnect failed'))

      const { result } = renderHook(() => useWallet())

      await act(async () => {
        await result.current.disconnect()
      })

      expect(result.current.error).toBe('Disconnect failed')
    })
  })
})
