'use client'

import { useState, useMemo } from 'react'
import { useVault } from '@/hooks/useVault'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { FundingFlow } from '@/components/FundingFlow'
import { WithdrawalFlow } from '@/components/WithdrawalFlow'
import { PaymentStatusTracker } from '@/components/PaymentStatusTracker'
import { Vault } from '@/types'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function isVaultLocked(maturityDate: Date): boolean {
  return new Date(maturityDate) > new Date()
}

function getDaysUntilMaturity(maturityDate: Date): number {
  const now = new Date()
  const maturity = new Date(maturityDate)
  const diff = maturity.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

interface VaultDetailProps {
  vault: Vault
  onBack: () => void
}

export default function VaultDetail({ vault, onBack }: VaultDetailProps) {
  const { fundingOrders, withdrawalOrders } = usePaymentStatus()
  const [activeTab, setActiveTab] = useState<'overview' | 'fund' | 'withdraw'>('overview')

  const progress = calculateProgress(vault.currentBalance, vault.targetAmount)
  const locked = isVaultLocked(vault.maturityDate)
  const daysRemaining = getDaysUntilMaturity(vault.maturityDate)

  const vaultFundingOrders = fundingOrders.filter((o) => o.vaultId === vault.id)
  const vaultWithdrawalOrders = withdrawalOrders.filter((o) => o.vaultId === vault.id)
  const activeOrders = [...vaultFundingOrders, ...vaultWithdrawalOrders].filter(
    (o) => o.status !== 'completed' && o.status !== 'failed' && o.status !== 'expired'
  )

  const recentTransactions = useMemo(() => {
    const deposits = vault.deposits.map((d) => ({
      id: d.id,
      type: 'deposit' as const,
      amount: d.amount,
      timestamp: d.timestamp,
      transactionHash: d.transactionHash,
    }))

    const withdrawals = vault.withdrawals.map((w) => ({
      id: w.id,
      type: 'withdrawal' as const,
      amount: w.amount,
      timestamp: w.timestamp,
      transactionHash: w.transactionHash,
    }))

    return [...deposits, ...withdrawals]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
  }, [vault.deposits, vault.withdrawals])

  const tabClasses = (tab: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
      activeTab === tab
        ? 'bg-primary-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`

  if (activeTab === 'fund') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveTab('overview')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
          aria-label="Back to vault overview"
        >
          &larr; Back to Overview
        </button>
        <FundingFlow vaultId={vault.id} />
      </div>
    )
  }

  if (activeTab === 'withdraw') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveTab('overview')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
          aria-label="Back to vault overview"
        >
          &larr; Back to Overview
        </button>
        <WithdrawalFlow vaultId={vault.id} vaultBalance={vault.currentBalance} />
      </div>
    )
  }

  return (
    <div className="space-y-6" role="region" aria-label={`Vault details for ${vault.name}`}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
        aria-label="Back to vault list"
      >
        &larr; Back to Vaults
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{vault.name}</h2>
          <p className="text-sm text-slate-500">
            Created {formatDate(vault.createdAt)}
          </p>
        </div>
        {locked ? (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
            aria-label={`Vault is locked until ${formatDate(vault.maturityDate)}`}
          >
            🔒 Locked
            {daysRemaining > 0 && (
              <span className="ml-1 text-blue-600">({daysRemaining}d)</span>
            )}
          </span>
        ) : (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
            aria-label="Vault is unlocked and ready for withdrawal"
          >
            🔓 Unlocked
          </span>
        )}
      </div>

      {/* Progress */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Progress</h3>
            <span className="text-lg font-bold text-slate-900">{progress}%</span>
          </div>
          <div
            className="w-full bg-slate-200 rounded-full h-4"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% of target achieved`}
          >
            <div
              className={`h-4 rounded-full transition-all duration-700 ease-out ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Current Balance</span>
              <p className="text-xl font-bold text-slate-900">
                {vault.currentBalance.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Target Amount</span>
              <p className="text-xl font-bold text-slate-900">
                {vault.targetAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Remaining to goal:{' '}
            <strong className="text-slate-700">
              {Math.max(0, vault.targetAmount - vault.currentBalance).toLocaleString()}
            </strong>
          </div>
        </div>
      </Card>

      {/* Maturity Info */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Lock Period</span>
            <p className="font-semibold text-slate-900">{vault.lockPeriod} days</p>
          </div>
          <div>
            <span className="text-slate-500">Maturity Date</span>
            <p className="font-semibold text-slate-900">{formatDate(vault.maturityDate)}</p>
          </div>
        </div>
        {locked ? (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            This vault is currently locked. Funds will be available for withdrawal after the maturity date.
          </div>
        ) : (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            This vault has matured. You can now withdraw your funds.
          </div>
        )}
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-2" role="tablist" aria-label="Vault actions">
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-controls="vault-overview-panel"
          id="vault-overview-tab"
          className={tabClasses('overview')}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'fund'}
          aria-controls="vault-fund-panel"
          id="vault-fund-tab"
          className={tabClasses('fund')}
          onClick={() => setActiveTab('fund')}
        >
          Fund Vault
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'withdraw'}
          aria-controls="vault-withdraw-panel"
          id="vault-withdraw-tab"
          className={tabClasses('withdraw')}
          onClick={() => setActiveTab('withdraw')}
          disabled={locked}
          aria-disabled={locked}
        >
          Withdraw
        </button>
      </div>

      {/* Overview panel */}
      <div
        role="tabpanel"
        id="vault-overview-panel"
        aria-labelledby="vault-overview-tab"
        className="space-y-6"
      >
        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Active Transactions</h3>
            {activeOrders.map((order) => (
              <PaymentStatusTracker key={order.id} order={order} />
            ))}
          </div>
        )}

        {/* Transaction history */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Transaction History</h3>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500" role="status">
              <p>No transactions yet. Fund your vault to get started.</p>
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Transaction history">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0"
                  role="listitem"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        tx.type === 'deposit'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                      aria-hidden="true"
                    >
                      {tx.type === 'deposit' ? '+' : '-'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 capitalize">
                        {tx.type}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {tx.transactionHash}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        tx.type === 'deposit' ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {tx.type === 'deposit' ? '+' : '-'}
                      {tx.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(tx.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
