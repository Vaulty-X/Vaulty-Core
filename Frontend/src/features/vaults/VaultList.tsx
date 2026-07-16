'use client'

// ─────────────────────────────────────────────────────────────────────────────
// VaultList
//
// Displays the list of savings vaults for the connected wallet.
// Server state is fetched via the useVaults hook (React Query), never read
// from Zustand.  Loading, error, and empty states are handled explicitly.
// ─────────────────────────────────────────────────────────────────────────────

import { useVaults } from '@/hooks/useVault'
import { useAppStore, selectIsWalletConnected } from '@/stores'
import type { Vault } from '@/types'

// ── Sub-components ────────────────────────────────────────────────────────────

function VaultCard({ vault }: { vault: Vault }) {
  const progress =
    vault.targetAmount > 0
      ? Math.min((vault.currentBalance / vault.targetAmount) * 100, 100)
      : 0

  return (
    <div className="bg-white rounded-xl shadow-md p-5 border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-900">{vault.name}</h3>
        <span className="text-sm text-slate-500">
          {vault.lockPeriod}d lock
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-slate-600 mb-1">
          <span>${vault.currentBalance.toLocaleString()}</span>
          <span>of ${vault.targetAmount.toLocaleString()}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${vault.name} progress: ${Math.round(progress)}%`}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1 text-right">
          {Math.round(progress)}% complete
        </p>
      </div>

      <p className="text-xs text-slate-400">
        Matures: {new Date(vault.maturityDate).toLocaleDateString()}
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-busy="true"
      aria-label="Loading vaults"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-md p-5 border border-slate-100 animate-pulse"
        >
          <div className="h-5 bg-slate-200 rounded w-2/3 mb-4" />
          <div className="h-2 bg-slate-200 rounded mb-2" />
          <div className="h-2 bg-slate-200 rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VaultList() {
  const isConnected = useAppStore(selectIsWalletConnected)
  const { data: vaults, isLoading, isError, error, refetch } = useVaults()

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Vaults</h2>
        <p className="text-slate-500">
          Connect your wallet to view your savings vaults.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <section aria-labelledby="vaults-heading">
        <h2
          id="vaults-heading"
          className="text-2xl font-bold text-slate-900 mb-4"
        >
          Your Vaults
        </h2>
        <LoadingSkeleton />
      </section>
    )
  }

  if (isError) {
    return (
      <section aria-labelledby="vaults-heading">
        <h2
          id="vaults-heading"
          className="text-2xl font-bold text-slate-900 mb-4"
        >
          Your Vaults
        </h2>
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-5 text-center"
          role="alert"
        >
          <p className="text-red-700 font-medium mb-2">
            Failed to load vaults
          </p>
          <p className="text-red-600 text-sm mb-4">
            {error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  const vaultList = vaults ?? []

  return (
    <section aria-labelledby="vaults-heading">
      <h2
        id="vaults-heading"
        className="text-2xl font-bold text-slate-900 mb-4"
      >
        Your Vaults
        <span className="ml-2 text-base font-normal text-slate-500">
          ({vaultList.length})
        </span>
      </h2>

      {vaultList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-slate-500 mb-2">You have no savings vaults yet.</p>
          <p className="text-slate-400 text-sm">
            Create your first vault to start saving.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaultList.map((vault) => (
            <VaultCard key={vault.id} vault={vault} />
          ))}
        </div>
      )}
    </section>
  )
}
