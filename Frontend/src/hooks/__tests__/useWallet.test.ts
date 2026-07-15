import { renderHook, act } from '@testing-library/react'
import { useWallet } from '../useWallet'
import { useAppStore } from '@/stores'
import { walletManager } from '@/lib/stellar'

// Mock the stellar wallet manager so tests don't hit real network
jest.mock('@/lib/stellar', () => ({
  walletManager: {
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
  },
}))

const mockedConnect = walletManager.connectWallet as jest.Mock
const mockedDisconnect = walletManager.disconnectWallet as jest.Mock

describe('useWallet', () => {
  beforeEach(() => {
    // Reset Zustand store state between tests
    useAppStore.setState({
      wallet: { isConnected: false, publicKey: null, network: 'testnet' },
    })
    jest.clearAllMocks()
  })

  it('returns initial disconnected wallet state', () => {
    const { result } = renderHook(() => useWallet())

    expect(result.current.wallet.isConnected).toBe(false)
    expect(result.current.wallet.publicKey).toBeNull()
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets isConnecting to true during connection', async () => {
    // Simulate a slow connect call
    let resolveFn: (value: string) => void
    mockedConnect.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFn = resolve
      })
    )

    const { result } = renderHook(() => useWallet())

    act(() => {
      result.current.connect()
    })

    expect(result.current.isConnecting).toBe(true)

    // Resolve connection
    await act(async () => {
      resolveFn!('GABC1234PUBLIC')
    })

    expect(result.current.isConnecting).toBe(false)
  })

  it('updates wallet state on successful connect', async () => {
    mockedConnect.mockResolvedValue('GABC1234PUBLICKEY')

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.wallet.isConnected).toBe(true)
    expect(result.current.wallet.publicKey).toBe('GABC1234PUBLICKEY')
    expect(result.current.wallet.network).toBe('testnet')
    expect(result.current.error).toBeNull()
  })

  it('sets error state when connect fails', async () => {
    mockedConnect.mockRejectedValue(new Error('Wallet connection not yet implemented'))

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.wallet.isConnected).toBe(false)
    expect(result.current.error).toBe('Wallet connection not yet implemented')
    expect(result.current.isConnecting).toBe(false)
  })

  it('sets a fallback error message when a non-Error is thrown', async () => {
    mockedConnect.mockRejectedValue('some string error')

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toBe('Failed to connect wallet')
  })

  it('disconnects wallet and clears state', async () => {
    // Start connected
    useAppStore.setState({
      wallet: { isConnected: true, publicKey: 'GABC1234PUBLICKEY', network: 'testnet' },
    })
    mockedDisconnect.mockResolvedValue(undefined)

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.wallet.isConnected).toBe(false)
    expect(result.current.wallet.publicKey).toBeNull()
  })

  it('sets error state when disconnect fails', async () => {
    mockedDisconnect.mockRejectedValue(new Error('Network error during disconnect'))

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.error).toBe('Network error during disconnect')
  })

  it('clears previous error on a new connect attempt', async () => {
    // First attempt fails
    mockedConnect.mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.error).toBe('Timeout')

    // Second attempt succeeds — error should be cleared
    mockedConnect.mockResolvedValueOnce('GNEWKEY')
    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.wallet.isConnected).toBe(true)
  })
})
