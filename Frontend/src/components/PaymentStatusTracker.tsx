'use client'

import { PaymentStatus, FundingOrder, WithdrawalOrder } from '@/types'
import { useVault } from '@/hooks/useVault'
import { Button } from './Button'

interface PaymentStatusTrackerProps {
  order: FundingOrder | WithdrawalOrder
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; description: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    description: 'Your request is being processed.',
  },
  awaiting_bank_transfer: {
    label: 'Awaiting Bank Transfer',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    description: 'Please complete the bank transfer using the instructions provided.',
  },
  processing: {
    label: 'Processing',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    description: 'Your payment is being confirmed on-chain.',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700 bg-green-50 border-green-200',
    description: 'Your transaction has been completed successfully.',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700 bg-red-50 border-red-200',
    description: 'Your transaction could not be completed.',
  },
  expired: {
    label: 'Expired',
    color: 'text-slate-700 bg-slate-50 border-slate-200',
    description: 'This payment request has expired.',
  },
}

export function PaymentStatusTracker({ order }: PaymentStatusTrackerProps) {
  const { retryFunding, retryWithdrawal, isProcessing } = useVault()
  const config = STATUS_CONFIG[order.status]
  const isRetryable = order.status === 'failed' || order.status === 'expired'

  const handleRetry = async () => {
    if (order.flow === 'deposit') {
      await retryFunding(order as FundingOrder)
    } else {
      await retryWithdrawal(order as WithdrawalOrder)
    }
  }

  return (
    <div className={`border rounded-lg px-4 py-3 ${config.color}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">{config.label}</span>
          <p className="text-sm mt-0.5 opacity-80">{config.description}</p>
          {order.status === 'failed' && order.failureReason && (
            <p className="text-sm mt-1 font-medium">Reason: {order.failureReason}</p>
          )}
        </div>
        {isRetryable && (
          <Button
            variant="secondary"
            size="sm"
            isLoading={isProcessing}
            onClick={handleRetry}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
