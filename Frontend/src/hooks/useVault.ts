import { useState } from 'react'
import { useAppStore } from '@/stores'
import { apiClient, generateIdempotencyKey } from '@/lib/api'
import { Vault, FundingOrder, WithdrawalOrder } from '@/types'

export function useVault() {
  const vaults = useAppStore((s) => s.vaults)
  const addVault = useAppStore((s) => s.addVault)
  const updateVault = useAppStore((s) => s.updateVault)
  const addFundingOrder = useAppStore((s) => s.addFundingOrder)
  const addWithdrawalOrder = useAppStore((s) => s.addWithdrawalOrder)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createVault = async (vaultData: Omit<Vault, 'id' | 'deposits' | 'withdrawals'>) => {
    const newVault: Vault = {
      ...vaultData,
      id: crypto.randomUUID(),
      deposits: [],
      withdrawals: [],
    }
    addVault(newVault)
    return newVault
  }

  const initiateFunding = async (
    vaultId: string,
    amount: number,
    bankAccountId: string
  ): Promise<FundingOrder | null> => {
    setIsProcessing(true)
    setError(null)
    try {
      const idempotencyKey = generateIdempotencyKey()
      const result = await apiClient.initiateDeposit(amount, bankAccountId, idempotencyKey)

      const order: FundingOrder = {
        id: result.depositId,
        flow: 'deposit',
        vaultId,
        amount,
        bankAccountId,
        status: result.status,
        paymentInstructions: result.paymentInstructions,
        fees: result.fees,
        conversion: result.conversion,
        failureReason: null,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      addFundingOrder(order)
      return order
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deposit initiation failed'
      setError(message)
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  const initiateWithdrawal = async (
    vaultId: string,
    amount: number,
    bankAccountId: string
  ): Promise<WithdrawalOrder | null> => {
    setIsProcessing(true)
    setError(null)
    try {
      const idempotencyKey = generateIdempotencyKey()
      const result = await apiClient.initiateWithdrawal(amount, bankAccountId, idempotencyKey)

      const order: WithdrawalOrder = {
        id: result.withdrawalId,
        flow: 'withdrawal',
        vaultId,
        amount,
        bankAccountId,
        status: result.status,
        fees: result.fees,
        conversion: result.conversion,
        failureReason: null,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      addWithdrawalOrder(order)
      return order
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withdrawal initiation failed'
      setError(message)
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  const retryFunding = async (order: FundingOrder) => {
    setIsProcessing(true)
    setError(null)
    try {
      const result = await apiClient.retryDeposit(order.id)
      const updateFundingOrderStatus = useAppStore.getState().updateFundingOrderStatus
      updateFundingOrderStatus(order.id, result.status)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed'
      setError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const retryWithdrawal = async (order: WithdrawalOrder) => {
    setIsProcessing(true)
    setError(null)
    try {
      const result = await apiClient.retryWithdrawal(order.id)
      const updateWithdrawalOrderStatus = useAppStore.getState().updateWithdrawalOrderStatus
      updateWithdrawalOrderStatus(order.id, result.status)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed'
      setError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    vaults,
    isProcessing,
    error,
    createVault,
    initiateFunding,
    initiateWithdrawal,
    retryFunding,
    retryWithdrawal,
  }
}
