'use client'

// ─────────────────────────────────────────────────────────────────────────────
// StreakTracker
//
// Displays the current saving streak and discipline score for the connected
// wallet.  Server state is fetched via the useStreak / useDisciplineScore
// hooks (React Query), never read from Zustand.
// ─────────────────────────────────────────────────────────────────────────────

import { useStreak, useDisciplineScore } from '@/hooks/useStreak'
import { useAppStore, selectIsWalletConnected } from '@/stores'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string
  value: string | number
  unit?: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        accent
          ? 'bg-indigo-50 border-indigo-200'
          : 'bg-white border-slate-100 shadow-sm'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold ${
          accent ? 'text-indigo-700' : 'text-slate-900'
        }`}
      >
        {value}
        {unit && (
          <span className="text-lg font-normal text-slate-400 ml-1">{unit}</span>
        )}
      </p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-2/3" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StreakTracker() {
  const isConnected = useAppStore(selectIsWalletConnected)

  const {
    data: streak,
    isLoading: streakLoading,
    isError: streakError,
    error: streakErrorMsg,
    refetch: refetchStreak,
  } = useStreak()

  const {
    data: score,
    isLoading: scoreLoading,
    isError: scoreError,
    error: scoreErrorMsg,
  } = useDisciplineScore()

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Streak Tracker
        </h2>
        <p className="text-slate-500">
          Connect your wallet to see your saving streak.
        </p>
      </div>
    )
  }

  const isLoading = streakLoading || scoreLoading
  const hasError = streakError || scoreError

  return (
    <section aria-labelledby="streak-heading">
      <h2
        id="streak-heading"
        className="text-2xl font-bold text-slate-900 mb-4"
      >
        Streak Tracker
      </h2>

      {hasError && (
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"
          role="alert"
        >
          <p className="text-red-700 text-sm font-medium">
            {streakErrorMsg?.message ?? scoreErrorMsg?.message ?? 'Failed to load streak data.'}
          </p>
          <button
            onClick={() => refetchStreak()}
            className="mt-2 text-red-600 underline text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Streak stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Current Streak"
              value={streak?.currentStreak ?? 0}
              unit="days"
              accent
            />
            <StatCard
              label="Longest Streak"
              value={streak?.longestStreak ?? 0}
              unit="days"
            />
            <StatCard
              label="Streak Freezes"
              value={streak?.freezesRemaining ?? 0}
              unit="left"
            />
            <StatCard
              label="Discipline Score"
              value={score?.score ?? '—'}
              unit={score ? '/100' : undefined}
            />
          </>
        )}
      </div>

      {/* Last deposit date */}
      {!isLoading && streak?.lastDepositDate && (
        <p className="text-sm text-slate-500">
          Last deposit:{' '}
          <span className="font-medium text-slate-700">
            {new Date(streak.lastDepositDate).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </p>
      )}

      {/* Streak calendar placeholder */}
      {!isLoading && streak && streak.calendar.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-800 mb-2">
            Savings Calendar
          </h3>
          <div
            className="flex flex-wrap gap-1"
            aria-label="Savings activity calendar"
          >
            {streak.calendar.slice(-30).map((day) => (
              <div
                key={day.date}
                title={`${new Date(day.date).toLocaleDateString()} — ${
                  day.deposited ? `$${day.amount ?? 0} saved` : 'No deposit'
                }`}
                className={`w-5 h-5 rounded-sm ${
                  day.deposited ? 'bg-indigo-500' : 'bg-slate-200'
                }`}
                aria-label={`${new Date(day.date).toLocaleDateString()}: ${
                  day.deposited ? 'deposit made' : 'no deposit'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
        </div>
      )}
    </section>
  )
}
