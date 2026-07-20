import { useState } from 'react'
import { useAppStore } from '@/stores'
import { walletManager, WalletConnectionError } from '@/lib/stellar'

export function useWallet() {
  const { wallet, setWalletConnected, setWalletDisconnected } = useAppStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lets consumers (inline UI or an error boundary further up the tree)
  // offer wallet-specific recovery copy instead of a generic error message.
  const [isWalletError, setIsWalletError] = useState(false)

  const connect = async () => {
    setIsConnecting(true)
    setError(null)
    setIsWalletError(false)

    try {
      const publicKey = await walletManager.connectWallet()
      setWalletConnected(publicKey, 'testnet')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      setIsWalletError(err instanceof WalletConnectionError)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      await walletManager.disconnectWallet()
      setWalletDisconnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet')
      setIsWalletError(err instanceof WalletConnectionError)
    }
  }

  return {
    wallet,
    isConnecting,
    error,
    isWalletError,
    connect,
    disconnect,
  }
}
