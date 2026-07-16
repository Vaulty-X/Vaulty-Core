// ─────────────────────────────────────────────────────────────────────────────
// Stellar wallet connection and transaction utilities
//
// This module handles wallet connection and transaction signing.
// All signing happens client-side via the user's wallet – private keys never
// leave the user's device.
//
// NOTE: Full wallet integration (e.g. Freighter, WalletConnect) will be wired
// up in a future milestone.  The stubs below define the interface that the
// rest of the codebase depends on.
// ─────────────────────────────────────────────────────────────────────────────

// @stellar/stellar-sdk does not export a browser wallet type – we type the
// internal wallet handle as `unknown` and narrow it where needed.
type StellarWalletHandle = { getPublicKey: () => string } | null

export class WalletManager {
  private wallet: StellarWalletHandle = null

  async connectWallet(): Promise<string> {
    try {
      // TODO: Integrate with a Stellar-compatible browser wallet
      // (e.g. Freighter via @stellar/freighter-api).
      throw new Error('Wallet connection not yet implemented')
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      throw error
    }
  }

  async disconnectWallet(): Promise<void> {
    this.wallet = null
  }

  async signTransaction(transactionXDR: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected')
    }

    try {
      // TODO: Sign transaction with user's wallet.
      // This happens client-side – private keys never leave the wallet.
      void transactionXDR
      throw new Error('Transaction signing not yet implemented')
    } catch (error) {
      console.error('Failed to sign transaction:', error)
      throw error
    }
  }

  getPublicKey(): string | null {
    return this.wallet?.getPublicKey() ?? null
  }
}

export const walletManager = new WalletManager()
