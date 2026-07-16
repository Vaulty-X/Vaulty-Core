'use client'

import { useVault } from '@/hooks/useVault'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { FundingFlow } from '@/components/FundingFlow'
import { WithdrawalFlow } from '@/components/WithdrawalFlow'
import { PaymentStatusTracker } from '@/components/PaymentStatusTracker'
import { Card } from '@/components/Card'

export default function Home() {
  const { vaults } = useVault()
  const { fundingOrders, withdrawalOrders } = usePaymentStatus()

  const activeOrders = [...fundingOrders, ...withdrawalOrders].filter(
    (o) => o.status !== 'completed' && o.status !== 'failed' && o.status !== 'expired'
  )

  const firstVaultId = vaults[0]?.id
  const firstVaultBalance = vaults[0]?.currentBalance ?? 0

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Welcome to Vaulty
          </h1>
          <p className="text-lg text-slate-600">
            Save consistently. Grow your wealth. Unlock financial opportunities.
          </p>
        </div>

        {activeOrders.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Active Transactions</h2>
            {activeOrders.map((order) => (
              <PaymentStatusTracker key={order.id} order={order} />
            ))}
          </div>
        )}

        {firstVaultId ? (
          <div className="grid gap-6 md:grid-cols-2">
            <FundingFlow vaultId={firstVaultId} />
            <WithdrawalFlow vaultId={firstVaultId} vaultBalance={firstVaultBalance} />
          </div>
        ) : (
          <Card>
            <p className="text-center text-slate-600">
              Create a savings vault to get started with deposits and withdrawals.
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}
