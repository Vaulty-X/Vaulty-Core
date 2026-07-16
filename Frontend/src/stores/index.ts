// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE STATE STORE (Zustand)
//
// THIS STORE INTENTIONALLY CONTAINS NO FINANCIAL DATA.
//
// Vaults, streak, discipline score, and achievements are server state – they
// are owned by React Query (see hooks/useVault.ts, hooks/useWallet.ts, etc.).
// Storing financial data here would create a stale second source of truth,
// introduce race conditions between optimistic updates and cache refreshes,
// and prevent proper cache invalidation on wallet / network changes.
//
// What belongs here:
//  ✔ Pure UI preferences (theme, panel expansion states, selected item IDs)
//  ✔ Wallet connection state (not balance / vault data)
//
// What does NOT belong here:
//  ✗ Vault balances, deposit lists, withdrawal lists
//  ✗ Streak counts or calendar data
//  ✗ Discipline scores or achievement lists
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UIPreferences, WalletState, ColorTheme } from '@/types'

// ── Wallet slice ──────────────────────────────────────────────────────────────

interface WalletSlice {
  wallet: WalletState
  setWalletConnected: (publicKey: string, network: 'testnet' | 'mainnet') => void
  setWalletDisconnected: () => void
}

// ── UI preferences slice ──────────────────────────────────────────────────────

interface UISlice {
  preferences: UIPreferences
  setColorTheme: (theme: ColorTheme) => void
  setSelectedVaultId: (id: string | null) => void
  setCalendarExpanded: (expanded: boolean) => void
}

// ── Combined store type ───────────────────────────────────────────────────────

type AppStore = WalletSlice & UISlice

// ── Store implementation ──────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── Wallet state ──
      wallet: {
        isConnected: false,
        publicKey: null,
        network: 'testnet',
      },

      setWalletConnected: (publicKey, network) =>
        set({ wallet: { isConnected: true, publicKey, network } }),

      setWalletDisconnected: () =>
        set({
          wallet: { isConnected: false, publicKey: null, network: 'testnet' },
        }),

      // ── UI preferences ──
      preferences: {
        colorTheme: 'system',
        selectedVaultId: null,
        calendarExpanded: false,
      },

      setColorTheme: (colorTheme) =>
        set((state) => ({
          preferences: { ...state.preferences, colorTheme },
        })),

      setSelectedVaultId: (selectedVaultId) =>
        set((state) => ({
          preferences: { ...state.preferences, selectedVaultId },
        })),

      setCalendarExpanded: (calendarExpanded) =>
        set((state) => ({
          preferences: { ...state.preferences, calendarExpanded },
        })),
    }),
    {
      name: 'vaulty-ui-prefs',
      // Only persist safe, non-financial fields.
      partialize: (state) => ({
        preferences: state.preferences,
        // Persist wallet connection state (public key only, never private key).
        wallet: state.wallet,
      }),
    }
  )
)

// ── Convenience selectors ─────────────────────────────────────────────────────

/** Returns the connected wallet's public key, or null when disconnected. */
export const selectPublicKey = (state: AppStore): string | null =>
  state.wallet.publicKey

/** Returns true when a wallet is connected. */
export const selectIsWalletConnected = (state: AppStore): boolean =>
  state.wallet.isConnected

/** Returns the active network. */
export const selectNetwork = (
  state: AppStore
): 'testnet' | 'mainnet' => state.wallet.network
