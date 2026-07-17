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

// Payment flow types

export type PaymentStatus =
  | 'pending'
  | 'awaiting_bank_transfer'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'

export type PaymentFlow = 'deposit' | 'withdrawal'

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  bankCode: string
}

export interface FeeInfo {
  platformFee: number
  networkFee: number
  totalFee: number
  currency: string
}

export interface ConversionInfo {
  inputAmount: number
  inputCurrency: string
  outputAmount: number
  outputCurrency: string
  exchangeRate: number
}

export interface PaymentInstructions {
  bankName: string
  accountNumber: string
  accountName: string
  reference: string
  amount: number
  currency: string
  expiresAt: string
}

export interface FundingOrder {
  id: string
  flow: 'deposit'
  vaultId: string
  amount: number
  bankAccountId: string
  status: PaymentStatus
  paymentInstructions: PaymentInstructions | null
  fees: FeeInfo | null
  conversion: ConversionInfo | null
  failureReason: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}

export interface WithdrawalOrder {
  id: string
  flow: 'withdrawal'
  vaultId: string
  amount: number
  bankAccountId: string
  status: PaymentStatus
  fees: FeeInfo | null
  conversion: ConversionInfo | null
  failureReason: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}

export type PaymentOrder = FundingOrder | WithdrawalOrder

// Regulated feature availability — driven by backend config with env-var fallback.
// All flags default to false so features remain off until explicitly enabled.
export interface FeatureFlags {
  lending: boolean
  borrowing: boolean
  investments: boolean
}
