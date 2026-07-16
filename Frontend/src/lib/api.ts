// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// Handles all HTTP communication with the Vaulty backend.
//
// Design rules:
//  • Every exported function is a plain async function that throws on error.
//  • No Zustand or React Query imports here – callers decide how to cache.
//  • Fiat on/off-ramp flows go through the backend (never directly to anchor).
//  • Vault / streak data is fetched server-side by public key.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Vault,
  Streak,
  DisciplineScore,
  Achievement,
  Deposit,
  Withdrawal,
} from '@/types'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api'

// ── Low-level request helper ──────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    // Attempt to surface a structured error message from the backend.
    let message = response.statusText
    try {
      const body = await response.json()
      message = body?.message ?? body?.error ?? message
    } catch {
      // Ignore JSON parse failures – keep the statusText.
    }
    throw new Error(`API error ${response.status}: ${message}`)
  }

  return response.json() as Promise<T>
}

// ── Vault queries ─────────────────────────────────────────────────────────────

/** Fetch all vaults belonging to the given Stellar public key. */
export async function fetchVaults(publicKey: string): Promise<Vault[]> {
  return request<Vault[]>(`/vaults?publicKey=${encodeURIComponent(publicKey)}`)
}

/** Fetch a single vault by ID. */
export async function fetchVault(
  publicKey: string,
  vaultId: string
): Promise<Vault> {
  return request<Vault>(
    `/vaults/${encodeURIComponent(vaultId)}?publicKey=${encodeURIComponent(publicKey)}`
  )
}

// ── Vault mutations ───────────────────────────────────────────────────────────

export interface CreateVaultPayload {
  name: string
  targetAmount: number
  lockPeriod: number // days
}

/** Create a new vault for the given public key. */
export async function createVault(
  publicKey: string,
  payload: CreateVaultPayload
): Promise<Vault> {
  return request<Vault>('/vaults', {
    method: 'POST',
    body: JSON.stringify({ publicKey, ...payload }),
  })
}

export interface DepositPayload {
  amount: number
  transactionHash: string
}

/** Record a confirmed on-chain deposit against a vault. */
export async function depositToVault(
  publicKey: string,
  vaultId: string,
  payload: DepositPayload
): Promise<Deposit> {
  return request<Deposit>(`/vaults/${encodeURIComponent(vaultId)}/deposits`, {
    method: 'POST',
    body: JSON.stringify({ publicKey, ...payload }),
  })
}

export interface WithdrawPayload {
  amount: number
  transactionHash: string
}

/** Record a confirmed on-chain withdrawal from a vault. */
export async function withdrawFromVault(
  publicKey: string,
  vaultId: string,
  payload: WithdrawPayload
): Promise<Withdrawal> {
  return request<Withdrawal>(
    `/vaults/${encodeURIComponent(vaultId)}/withdrawals`,
    {
      method: 'POST',
      body: JSON.stringify({ publicKey, ...payload }),
    }
  )
}

// ── Streak queries ────────────────────────────────────────────────────────────

/** Fetch the saving streak for the given public key. */
export async function fetchStreak(publicKey: string): Promise<Streak> {
  return request<Streak>(
    `/streaks?publicKey=${encodeURIComponent(publicKey)}`
  )
}

// ── Discipline score queries ──────────────────────────────────────────────────

/** Fetch the discipline score for the given public key. */
export async function fetchDisciplineScore(
  publicKey: string
): Promise<DisciplineScore> {
  return request<DisciplineScore>(
    `/discipline-score?publicKey=${encodeURIComponent(publicKey)}`
  )
}

// ── Achievement queries ───────────────────────────────────────────────────────

/** Fetch all achievements (locked and unlocked) for the given public key. */
export async function fetchAchievements(
  publicKey: string
): Promise<Achievement[]> {
  return request<Achievement[]>(
    `/achievements?publicKey=${encodeURIComponent(publicKey)}`
  )
}

// ── Fiat on/off-ramp (backend-proxied) ───────────────────────────────────────

export interface InitiateDepositResult {
  depositId: string
  status: string
  paymentInstructions: unknown
}

/** Initiate a NGN → USDC fiat deposit via the licensed anchor partner. */
export async function initiateDeposit(
  amount: number,
  bankAccountId: string
): Promise<InitiateDepositResult> {
  return request<InitiateDepositResult>('/deposits/initiate', {
    method: 'POST',
    body: JSON.stringify({ amount, bankAccountId }),
  })
}

export interface InitiateWithdrawalResult {
  withdrawalId: string
  status: string
}

/** Initiate a USDC → NGN fiat withdrawal via the licensed anchor partner. */
export async function initiateWithdrawal(
  amount: number,
  bankAccountId: string
): Promise<InitiateWithdrawalResult> {
  return request<InitiateWithdrawalResult>('/withdrawals/initiate', {
    method: 'POST',
    body: JSON.stringify({ amount, bankAccountId }),
  })
}

export interface FiatOperationStatus {
  status: string
  amount: number
  completedAt?: string
}

/** Poll the status of a fiat deposit. */
export async function getDepositStatus(
  depositId: string
): Promise<FiatOperationStatus> {
  return request<FiatOperationStatus>(`/deposits/${encodeURIComponent(depositId)}/status`)
}

/** Poll the status of a fiat withdrawal. */
export async function getWithdrawalStatus(
  withdrawalId: string
): Promise<FiatOperationStatus> {
  return request<FiatOperationStatus>(
    `/withdrawals/${encodeURIComponent(withdrawalId)}/status`
  )
}

// ── Legacy class export (kept for backward compat during migration) ───────────

/** @deprecated Use the individual exported functions instead. */
export class ApiClient {
  initiateDeposit = initiateDeposit
  initiateWithdrawal = initiateWithdrawal
  getDepositStatus = getDepositStatus
  getWithdrawalStatus = getWithdrawalStatus
}

/** @deprecated Use the individual exported functions instead. */
export const apiClient = new ApiClient()
