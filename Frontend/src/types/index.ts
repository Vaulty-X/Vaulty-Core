// ─────────────────────────────────────────────────────────────────────────────
// SERVER / DOMAIN TYPES
// These types represent data that originates from the backend or on-chain and
// must never be treated as the source of truth on the client.  They are fetched
// via React Query and always refreshed from the server on wallet / network
// changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vault {
  id: string
  name: string
  targetAmount: number
  currentBalance: number
  lockPeriod: number // days
  createdAt: string  // ISO 8601 – keep as string so JSON round-trips are safe
  maturityDate: string
  deposits: Deposit[]
  withdrawals: Withdrawal[]
}

export interface Deposit {
  id: string
  vaultId: string
  amount: number
  timestamp: string
  transactionHash: string
}

export interface Withdrawal {
  id: string
  vaultId: string
  amount: number
  timestamp: string
  transactionHash: string
}

export interface Streak {
  currentStreak: number
  longestStreak: number
  freezesRemaining: number
  lastDepositDate: string | null // ISO 8601 or null
  calendar: StreakDay[]
}

export interface StreakDay {
  date: string  // ISO 8601
  deposited: boolean
  amount?: number
}

export interface DisciplineScore {
  score: number // 0–100
  factors: {
    consistency: number
    streakLength: number
    goalCompletion: number
    repaymentHistory: number
    investmentActivity: number
  }
}

export interface Achievement {
  id: string
  title: string
  description: string
  unlockedAt: string | null // ISO 8601 or null
  icon: string
}

export interface Loan {
  id: string
  borrower: string
  amount: number
  collateralVaultId: string
  interestRate: number
  maturityDate: string
  status: 'active' | 'repaid' | 'defaulted'
}

export interface Investment {
  id: string
  type: 'conservative' | 'balanced' | 'growth'
  amount: number
  expectedReturn: number
  currentValue: number
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET / NETWORK STATE
// Derived from the user's connected wallet; not persisted in Zustand.
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletState {
  isConnected: boolean
  publicKey: string | null
  network: 'testnet' | 'mainnet'
}

// ─────────────────────────────────────────────────────────────────────────────
// UI PREFERENCE TYPES
// The only things that belong in the Zustand store (persisted to localStorage).
// These are purely cosmetic / navigational – never financial source-of-truth.
// ─────────────────────────────────────────────────────────────────────────────

export type ColorTheme = 'light' | 'dark' | 'system'

export interface UIPreferences {
  /** Theme preference selected by the user. */
  colorTheme: ColorTheme
  /** The vault the user last had open, used to restore navigation state. */
  selectedVaultId: string | null
  /** Whether the savings-calendar panel is expanded. */
  calendarExpanded: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT QUERY KEY FACTORIES
// Centralising query keys here avoids typo-driven cache misses and makes
// invalidation explicit and safe.
// ─────────────────────────────────────────────────────────────────────────────

export const queryKeys = {
  vaults: (publicKey: string) => ['vaults', publicKey] as const,
  vault: (publicKey: string, vaultId: string) =>
    ['vaults', publicKey, vaultId] as const,
  streak: (publicKey: string) => ['streak', publicKey] as const,
  disciplineScore: (publicKey: string) =>
    ['disciplineScore', publicKey] as const,
  achievements: (publicKey: string) => ['achievements', publicKey] as const,
} as const
