// ─────────────────────────────────────────────────────────────────────────────
// useVault – server-state hooks for vault data
//
// All vault data is owned by React Query.  Zustand is used only to read the
// connected wallet's public key (a UI concern), never to store vault balances.
//
// Cache invalidation strategy:
//  • Mutations (create / deposit / withdraw) invalidate the vaults query for
//    the current public key so the list and individual vault are refreshed
//    from the server immediately after a successful transaction.
//  • The wallet hook invalidates everything when the wallet changes (see
//    hooks/useWallet.ts).
// ─────────────────────────────────────────────────────────────────────────────

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  fetchVaults,
  fetchVault,
  createVault as apiCreateVault,
  depositToVault as apiDeposit,
  withdrawFromVault as apiWithdraw,
  type CreateVaultPayload,
  type DepositPayload,
  type WithdrawPayload,
} from '@/lib/api'
import { useAppStore, selectPublicKey } from '@/stores'
import { queryKeys, type Vault, type Deposit, type Withdrawal } from '@/types'

// ── Vault list query ──────────────────────────────────────────────────────────

/**
 * Returns the list of vaults for the currently connected wallet.
 * The query is disabled (and returns an empty array) when no wallet is
 * connected, preventing unnecessary network requests.
 */
export function useVaults(): UseQueryResult<Vault[], Error> {
  const publicKey = useAppStore(selectPublicKey)

  return useQuery({
    queryKey: queryKeys.vaults(publicKey ?? ''),
    queryFn: () => fetchVaults(publicKey!),
    // Only run when a wallet is connected.
    enabled: !!publicKey,
    // Financial data – keep fresh.
    staleTime: 30_000,          // 30 s
    gcTime: 5 * 60 * 1000,     // 5 min
    // Surface backend errors to the component.
    retry: 2,
  })
}

// ── Single vault query ────────────────────────────────────────────────────────

/**
 * Returns a single vault by ID.  Disabled when no wallet is connected or no
 * vault ID is provided.
 */
export function useVaultById(
  vaultId: string | null
): UseQueryResult<Vault, Error> {
  const publicKey = useAppStore(selectPublicKey)

  return useQuery({
    queryKey: queryKeys.vault(publicKey ?? '', vaultId ?? ''),
    queryFn: () => fetchVault(publicKey!, vaultId!),
    enabled: !!publicKey && !!vaultId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  })
}

// ── Create vault mutation ─────────────────────────────────────────────────────

/**
 * Returns a mutation for creating a new vault.
 * On success the vault list cache is invalidated so the UI reflects the new
 * vault without requiring a manual refresh.
 */
export function useCreateVault(): UseMutationResult<
  Vault,
  Error,
  CreateVaultPayload
> {
  const queryClient = useQueryClient()
  const publicKey = useAppStore(selectPublicKey)

  return useMutation({
    mutationFn: (payload: CreateVaultPayload) => {
      if (!publicKey) throw new Error('Wallet not connected')
      return apiCreateVault(publicKey, payload)
    },
    onSuccess: () => {
      // Invalidate the vault list so it refreshes from the server.
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults(publicKey ?? ''),
      })
    },
  })
}

// ── Deposit mutation ──────────────────────────────────────────────────────────

interface DepositArgs {
  vaultId: string
  payload: DepositPayload
}

/**
 * Returns a mutation for recording a confirmed on-chain deposit.
 * Invalidates both the vault list and the individual vault cache entry.
 */
export function useDeposit(): UseMutationResult<Deposit, Error, DepositArgs> {
  const queryClient = useQueryClient()
  const publicKey = useAppStore(selectPublicKey)

  return useMutation({
    mutationFn: ({ vaultId, payload }: DepositArgs) => {
      if (!publicKey) throw new Error('Wallet not connected')
      return apiDeposit(publicKey, vaultId, payload)
    },
    onSuccess: (_data, { vaultId }) => {
      const key = publicKey ?? ''
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults(key) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vault(key, vaultId) })
      // A deposit may update the streak and discipline score too.
      queryClient.invalidateQueries({ queryKey: queryKeys.streak(key) })
      queryClient.invalidateQueries({ queryKey: queryKeys.disciplineScore(key) })
    },
  })
}

// ── Withdrawal mutation ───────────────────────────────────────────────────────

interface WithdrawArgs {
  vaultId: string
  payload: WithdrawPayload
}

/**
 * Returns a mutation for recording a confirmed on-chain withdrawal.
 * Invalidates both the vault list and the individual vault cache entry.
 */
export function useWithdraw(): UseMutationResult<
  Withdrawal,
  Error,
  WithdrawArgs
> {
  const queryClient = useQueryClient()
  const publicKey = useAppStore(selectPublicKey)

  return useMutation({
    mutationFn: ({ vaultId, payload }: WithdrawArgs) => {
      if (!publicKey) throw new Error('Wallet not connected')
      return apiWithdraw(publicKey, vaultId, payload)
    },
    onSuccess: (_data, { vaultId }) => {
      const key = publicKey ?? ''
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults(key) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vault(key, vaultId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.disciplineScore(key) })
    },
  })
}
