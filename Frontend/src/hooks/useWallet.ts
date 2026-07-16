// ─────────────────────────────────────────────────────────────────────────────
// useWallet – wallet connection hook with React Query cache invalidation
//
// Wallet connection state is stored in Zustand (it is a UI concern: is the
// user logged in?).  Financial server state (vaults, streak, discipline score)
// lives in React Query.
//
// Invalidation strategy:
//  • When the wallet connects or disconnects ALL financial query caches are
//    cleared so stale data from a previous session can never bleed through.
//  • When the network changes the same full invalidation is applied.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore, selectPublicKey } from '@/stores'
import { walletManager } from '@/lib/stellar'
import type { WalletState } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Remove all queries that are scoped to a particular public key.
 * This prevents stale vault / streak / score data from a previous session
 * from being shown after the wallet changes.
 */
function invalidateAllFinancialQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  publicKey: string | null
) {
  if (!publicKey) {
    // No specific key – clear everything financial.
    queryClient.removeQueries({ queryKey: ['vaults'] })
    queryClient.removeQueries({ queryKey: ['streak'] })
    queryClient.removeQueries({ queryKey: ['disciplineScore'] })
    queryClient.removeQueries({ queryKey: ['achievements'] })
    return
  }

  queryClient.invalidateQueries({ queryKey: ['vaults', publicKey] })
  queryClient.invalidateQueries({ queryKey: ['streak', publicKey] })
  queryClient.invalidateQueries({ queryKey: ['disciplineScore', publicKey] })
  queryClient.invalidateQueries({ queryKey: ['achievements', publicKey] })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWalletReturn {
  wallet: WalletState
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

export function useWallet(): UseWalletReturn {
  const queryClient = useQueryClient()
  const { wallet, setWalletConnected, setWalletDisconnected } = useAppStore()
  const previousPublicKey = useAppStore(selectPublicKey)

  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const publicKey = await walletManager.connectWallet()

      // If a different wallet was previously connected, clear the old cache
      // before writing the new connection to the store.
      if (previousPublicKey && previousPublicKey !== publicKey) {
        invalidateAllFinancialQueries(queryClient, previousPublicKey)
      }

      setWalletConnected(publicKey, 'testnet')

      // Pre-fetch financial data for the newly connected wallet so the UI
      // feels responsive immediately.
      queryClient.invalidateQueries({ queryKey: ['vaults', publicKey] })
      queryClient.invalidateQueries({ queryKey: ['streak', publicKey] })
      queryClient.invalidateQueries({ queryKey: ['disciplineScore', publicKey] })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect wallet'
      )
    } finally {
      setIsConnecting(false)
    }
  }, [queryClient, previousPublicKey, setWalletConnected])

  const disconnect = useCallback(async () => {
    setError(null)

    try {
      await walletManager.disconnectWallet()

      // Clear all financial caches for this wallet before marking it as
      // disconnected.  This prevents another user on the same device from
      // briefly seeing the previous user's data.
      invalidateAllFinancialQueries(queryClient, previousPublicKey)

      setWalletDisconnected()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to disconnect wallet'
      )
    }
  }, [queryClient, previousPublicKey, setWalletDisconnected])

  return {
    wallet,
    isConnecting,
    error,
    connect,
    disconnect,
  }
}
