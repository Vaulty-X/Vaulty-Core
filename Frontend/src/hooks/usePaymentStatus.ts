import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores'
import { apiClient, ApiError } from '@/lib/api'
import { PaymentStatus, FundingOrder, WithdrawalOrder } from '@/types'

const POLL_INTERVAL_MS = 5_000
const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  'completed',
  'failed',
  'expired',
])

function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

export function usePaymentStatus() {
  const fundingOrders = useAppStore((s) => s.fundingOrders)
  const withdrawalOrders = useAppStore((s) => s.withdrawalOrders)
  const updateFundingOrderStatus = useAppStore((s) => s.updateFundingOrderStatus)
  const updateWithdrawalOrderStatus = useAppStore((s) => s.updateWithdrawalOrderStatus)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollDeposit = useCallback(
    async (order: FundingOrder) => {
      try {
        const result = await apiClient.getDepositStatus(order.id)
        updateFundingOrderStatus(order.id, result.status, result.failureReason)
      } catch (err) {
        if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) {
          updateFundingOrderStatus(order.id, 'failed', err.message)
        }
      }
    },
    [updateFundingOrderStatus]
  )

  const pollWithdrawal = useCallback(
    async (order: WithdrawalOrder) => {
      try {
        const result = await apiClient.getWithdrawalStatus(order.id)
        updateWithdrawalOrderStatus(order.id, result.status, result.failureReason)
      } catch (err) {
        if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) {
          updateWithdrawalOrderStatus(order.id, 'failed', err.message)
        }
      }
    },
    [updateWithdrawalOrderStatus]
  )

  useEffect(() => {
    const activeFunding = fundingOrders.filter((o) => !isTerminal(o.status))
    const activeWithdrawals = withdrawalOrders.filter((o) => !isTerminal(o.status))
    const hasActive = activeFunding.length > 0 || activeWithdrawals.length > 0

    if (!hasActive) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    const poll = () => {
      activeFunding.forEach(pollDeposit)
      activeWithdrawals.forEach(pollWithdrawal)
    }

    poll()
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [fundingOrders, withdrawalOrders, pollDeposit, pollWithdrawal])

  return {
    fundingOrders,
    withdrawalOrders,
  }
}
