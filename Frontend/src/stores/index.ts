import { create } from 'zustand'
import { WalletState, Vault, Streak, DisciplineScore } from '@/types'

interface AppState {
  wallet: WalletState
  vaults: Vault[]
  streak: Streak | null
  disciplineScore: DisciplineScore | null
  
  // Wallet actions
  setWalletConnected: (publicKey: string, network: 'testnet' | 'mainnet') => void
  setWalletDisconnected: () => void
  
  // Vault actions
  setVaults: (vaults: Vault[]) => void
  addVault: (vault: Vault) => void
  updateVault: (id: string, updates: Partial<Vault>) => void
  
  // Streak actions
  setStreak: (streak: Streak) => void
  
  // Discipline score actions
  setDisciplineScore: (score: DisciplineScore) => void
}

export const useAppStore = create<AppState>((set) => ({
  wallet: {
    isConnected: false,
    publicKey: null,
    network: 'testnet',
  },
  vaults: [],
  streak: null,
  disciplineScore: null,
  
  setWalletConnected: (publicKey, network) =>
    set({
      wallet: { isConnected: true, publicKey, network },
    }),
  
  setWalletDisconnected: () =>
    set({
      wallet: { isConnected: false, publicKey: null, network: 'testnet' },
    }),
  
  setVaults: (vaults) => set({ vaults }),
  
  addVault: (vault) =>
    set((state) => ({ vaults: [...state.vaults, vault] })),
  
  updateVault: (id, updates) =>
    set((state) => ({
      vaults: state.vaults.map((vault) =>
        vault.id === id ? { ...vault, ...updates } : vault
      ),
    })),
  
  setStreak: (streak) => set({ streak }),
  
  setDisciplineScore: (score) => set({ disciplineScore: score }),
}))
