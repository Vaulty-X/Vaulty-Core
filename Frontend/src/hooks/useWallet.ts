import { useState } from 'react'
import { useAppStore } from '@/stores'
import { walletManager } from '@/lib/stellar'
import { WalletConnectionError, isWalletError } from '@/lib/api'

export type WalletErrorKind = 'wallet' | 'general'

export interface WalletError {
  message: string
  kind: WalletErrorKind
}

export function useWallet() {
  const { wallet, setWalletConnected, setWalletDisconnected } = useAppStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<WalletError | null>(null)
  
  const connect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      const publicKey = await walletManager.connectWallet()
      setWalletConnected(publicKey, 'testnet')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet'
      const kind: WalletErrorKind = isWalletError(err) ? 'wallet' : 'general'
      setError({ message, kind })
    } finally {
      setIsConnecting(false)
    }
  }
  
  const disconnect = async () => {
    try {
      await walletManager.disconnectWallet()
      setWalletDisconnected()
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect wallet'
      setError({ message, kind: 'general' })
    }
  }
  
  /** Convenience: expose whether the current error is wallet-specific. */
  const isWalletConnectionError = error?.kind === 'wallet'

  return {
    wallet,
    isConnecting,
    error,
    isWalletConnectionError,
    connect,
    disconnect,
  }
}
