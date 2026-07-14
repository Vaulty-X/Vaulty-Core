import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores'
import { walletManager } from '@/lib/stellar'

export function useWallet() {
  const { wallet, setWalletConnected, setWalletDisconnected } = useAppStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const connect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      const publicKey = await walletManager.connectWallet()
      setWalletConnected(publicKey, 'testnet')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
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
    }
  }
  
  return {
    wallet,
    isConnecting,
    error,
    connect,
    disconnect,
  }
}
