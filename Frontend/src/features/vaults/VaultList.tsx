'use client'

import { useVault } from '@/hooks/useVault'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Vault } from '@/types'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function calculateProgress(currentBalance: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0
  return Math.min(Math.round((currentBalance / targetAmount) * 100), 100)
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-green-500'
  if (percentage >= 50) return 'bg-primary-500'
  if (percentage >= 25) return 'bg-accent-500'
  return 'bg-slate-300'
}

function getDaysUntilMaturity(maturityDate: Date): number {
  const now = new Date()
  const maturity = new Date(maturityDate)
  const diff = maturity.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function isLocked(maturityDate: Date): boolean {
  return new Date(maturityDate) > new Date()
}

interface VaultCardProps {
  vault: Vault
  onSelect: (vault: Vault) => void
}

function VaultCard({ vault, onSelect }: VaultCardProps) {
  const progress = calculateProgress(vault.currentBalance, vault.targetAmount)
  const daysRemaining = getDaysUntilMaturity(vault.maturityDate)
  const locked = isLocked(vault.maturityDate)

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900 truncate">
            {vault.name}
          </h3>
          <p className="text-sm text-slate-500">
            Created {formatDate(vault.createdAt)}
          </p>
        </div>
        {locked ? (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            aria-label="Vault is locked"
          >
            🔒 Locked
          </span>
        ) : (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            aria-label="Vault is unlocked"
          >
            🔓 Unlocked
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium text-slate-900" aria-label={`${progress}% complete`}>
            {progress}%
          </span>
        </div>
        <div
          className="w-full bg-slate-200 rounded-full h-2.5"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress toward target of ${vault.targetAmount}`}
        >
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Balance and target */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Saved</span>
          <p className="font-semibold text-slate-900">
            {vault.currentBalance.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-slate-500">Target</span>
          <p className="font-semibold text-slate-900">
            {vault.targetAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Lock period info */}
      <div className="text-sm text-slate-500">
        {locked ? (
          <span>
            Matures in <strong className="text-slate-700">{daysRemaining} days</strong> ({formatDate(vault.maturityDate)})
          </span>
        ) : (
          <span>
            Matured on {formatDate(vault.maturityDate)}
          </span>
        )}
      </div>

      {/* Deposit/Withdrawal stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{vault.deposits.length} deposit{vault.deposits.length !== 1 ? 's' : ''}</span>
        <span aria-hidden="true">·</span>
        <span>{vault.withdrawals.length} withdrawal{vault.withdrawals.length !== 1 ? 's' : ''}</span>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => onSelect(vault)}
        aria-label={`View details for ${vault.name}`}
      >
        View Details
      </Button>
    </Card>
  )
}

interface VaultListProps {
  onSelectVault?: (vault: Vault) => void
  onCreateNew?: () => void
}

export default function VaultList({ onSelectVault, onCreateNew }: VaultListProps) {
  const { vaults } = useVault()

  if (vaults.length === 0) {
    return (
      <Card>
        <div className="text-center py-8" role="status">
          <div className="text-4xl mb-4">🏦</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No Vaults Yet</h2>
          <p className="text-slate-600 mb-6">
            Create your first savings vault to start building your wealth.
          </p>
          {onCreateNew && (
            <Button onClick={onCreateNew} variant="primary">
              Create Your First Vault
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4" role="region" aria-label="Your savings vaults">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">
          Your Vaults
        </h2>
        <span className="text-sm text-slate-500" aria-live="polite">
          {vaults.length} vault{vaults.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vaults.map((vault) => (
          <VaultCard
            key={vault.id}
            vault={vault}
            onSelect={onSelectVault ?? (() => {})}
          />
        ))}
      </div>
    </div>
  )
}
