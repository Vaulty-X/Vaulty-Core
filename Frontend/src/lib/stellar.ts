// Stellar wallet connection and transaction utilities
// This module handles wallet connection and transaction signing
// All signing happens client-side via the user's wallet

import { WalletConnectionError, WalletNotConnectedError } from '@/lib/api'

// StellarWallet type is a placeholder for the Stellar-compatible wallet SDK
// that will be wired up in Phase 1 implementation.
// eslint-disable-next-line -- @typescript-eslint/no-explicit-any (plugin not installed)
type StellarWallet = any

export class WalletManager {
  private wallet: StellarWallet | null = null
  
  async connectWallet(): Promise<string> {
    try {
      // Initialize wallet connection
      // This will integrate with Stellar-compatible wallets
      // Implementation depends on the specific wallet SDK used
      throw new WalletConnectionError('Wallet connection not yet implemented')
    } catch (error) {
      // Re-wrap unknown errors so callers always receive a WalletConnectionError
      if (error instanceof WalletConnectionError) throw error
      console.error('Failed to connect wallet:', error)
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to connect wallet',
        error
      )
    }
  }
  
  async disconnectWallet(): Promise<void> {
    this.wallet = null
  }
  
  async signTransaction(transactionXDR: string): Promise<string> {
    if (!this.wallet) {
      throw new WalletNotConnectedError()
    }
    
    try {
      // Sign transaction with user's wallet
      // This happens client-side, private keys never leave the wallet
      throw new Error('Transaction signing not yet implemented')
    } catch (error) {
      console.error('Failed to sign transaction:', error)
      throw error
    }
  }
  
  getPublicKey(): string | null {
    return this.wallet?.getPublicKey() || null
  }
}

export const walletManager = new WalletManager()
