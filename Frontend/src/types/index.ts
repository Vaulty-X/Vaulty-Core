// Shared TypeScript types for the Vaulty frontend

export interface Vault {
  id: string
  name: string
  targetAmount: number
  currentBalance: number
  lockPeriod: number // in days
  createdAt: Date
  maturityDate: Date
  deposits: Deposit[]
  withdrawals: Withdrawal[]
}

export interface Deposit {
  id: string
  vaultId: string
  amount: number
  timestamp: Date
  transactionHash: string
}

export interface Withdrawal {
  id: string
  vaultId: string
  amount: number
  timestamp: Date
  transactionHash: string
}

export interface Streak {
  currentStreak: number
  longestStreak: number
  freezesRemaining: number
  lastDepositDate: Date | null
  calendar: StreakDay[]
}

export interface StreakDay {
  date: Date
  deposited: boolean
  amount?: number
}

export interface DisciplineScore {
  score: number // 0-100
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
  unlockedAt: Date | null
  icon: string
}

export interface WalletState {
  isConnected: boolean
  publicKey: string | null
  network: 'testnet' | 'mainnet'
}

export interface Loan {
  id: string
  borrower: string
  amount: number
  collateralVaultId: string
  interestRate: number
  maturityDate: Date
  status: 'active' | 'repaid' | 'defaulted'
}

export interface Investment {
  id: string
  type: 'conservative' | 'balanced' | 'growth'
  amount: number
  expectedReturn: number
  currentValue: number
}
