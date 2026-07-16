import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  WalletState,
  Vault,
  Streak,
  DisciplineScore,
  FundingOrder,
  WithdrawalOrder,
  PaymentStatus,
  BankAccount,
} from '@/types'

interface AppState {
  wallet: WalletState
  vaults: Vault[]
  streak: Streak | null
  disciplineScore: DisciplineScore | null
  bankAccounts: BankAccount[]
  selectedBankAccountId: string | null
  fundingOrders: FundingOrder[]
  withdrawalOrders: WithdrawalOrder[]

  setWalletConnected: (publicKey: string, network: 'testnet' | 'mainnet') => void
  setWalletDisconnected: () => void

  setVaults: (vaults: Vault[]) => void
  addVault: (vault: Vault) => void
  updateVault: (id: string, updates: Partial<Vault>) => void

  setStreak: (streak: Streak) => void
  setDisciplineScore: (score: DisciplineScore) => void

  setBankAccounts: (accounts: BankAccount[]) => void
  setSelectedBankAccount: (id: string | null) => void

  addFundingOrder: (order: FundingOrder) => void
  updateFundingOrderStatus: (id: string, status: PaymentStatus, failureReason?: string) => void
  removeFundingOrder: (id: string) => void

  addWithdrawalOrder: (order: WithdrawalOrder) => void
  updateWithdrawalOrderStatus: (id: string, status: PaymentStatus, failureReason?: string) => void
  removeWithdrawalOrder: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      wallet: {
        isConnected: false,
        publicKey: null,
        network: 'testnet',
      },
      vaults: [],
      streak: null,
      disciplineScore: null,
      bankAccounts: [],
      selectedBankAccountId: null,
      fundingOrders: [],
      withdrawalOrders: [],

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

      setBankAccounts: (accounts) => set({ bankAccounts: accounts }),

      setSelectedBankAccount: (id) => set({ selectedBankAccountId: id }),

      addFundingOrder: (order) =>
        set((state) => ({
          fundingOrders: [order, ...state.fundingOrders],
        })),

      updateFundingOrderStatus: (id, status, failureReason) =>
        set((state) => ({
          fundingOrders: state.fundingOrders.map((order) =>
            order.id === id
              ? {
                  ...order,
                  status,
                  failureReason: failureReason ?? order.failureReason,
                  updatedAt: new Date().toISOString(),
                }
              : order
          ),
        })),

      removeFundingOrder: (id) =>
        set((state) => ({
          fundingOrders: state.fundingOrders.filter((order) => order.id !== id),
        })),

      addWithdrawalOrder: (order) =>
        set((state) => ({
          withdrawalOrders: [order, ...state.withdrawalOrders],
        })),

      updateWithdrawalOrderStatus: (id, status, failureReason) =>
        set((state) => ({
          withdrawalOrders: state.withdrawalOrders.map((order) =>
            order.id === id
              ? {
                  ...order,
                  status,
                  failureReason: failureReason ?? order.failureReason,
                  updatedAt: new Date().toISOString(),
                }
              : order
          ),
        })),

      removeWithdrawalOrder: (id) =>
        set((state) => ({
          withdrawalOrders: state.withdrawalOrders.filter(
            (order) => order.id !== id
          ),
        })),
    }),
    {
      name: 'vaulty-payments',
      partialize: (state) => ({
        fundingOrders: state.fundingOrders,
        withdrawalOrders: state.withdrawalOrders,
        bankAccounts: state.bankAccounts,
        selectedBankAccountId: state.selectedBankAccountId,
      }),
    }
  )
)
