'use client'

import { useState } from 'react'
import { useVault } from '@/hooks/useVault'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { FundingOrder } from '@/types'
import { Input } from './Input'
import { Button } from './Button'
import { Card } from './Card'
import { BankAccountSelector } from './BankAccountSelector'
import { PaymentInstructionsDisplay } from './PaymentInstructions'
import { PaymentStatusTracker } from './PaymentStatusTracker'

const MIN_AMOUNT = 500
const MAX_AMOUNT = 5_000_000

interface FundingFlowProps {
  vaultId: string
}

export function FundingFlow({ vaultId }: FundingFlowProps) {
  const { initiateFunding, isProcessing, error } = useVault()
  const { fundingOrders } = usePaymentStatus()
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [bankAccountError, setBankAccountError] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<FundingOrder | null>(null)

  const vaultFundingOrders = fundingOrders.filter((o) => o.vaultId === vaultId)
  const inProgressOrder = vaultFundingOrders.find(
    (o) => o.status !== 'completed' && o.status !== 'failed' && o.status !== 'expired'
  )

  const validate = (): boolean => {
    let valid = true

    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount)) {
      setAmountError('Please enter a valid amount')
      valid = false
    } else if (numAmount < MIN_AMOUNT) {
      setAmountError(`Minimum amount is NGN ${MIN_AMOUNT.toLocaleString()}`)
      valid = false
    } else if (numAmount > MAX_AMOUNT) {
      setAmountError(`Maximum amount is NGN ${MAX_AMOUNT.toLocaleString()}`)
      valid = false
    } else {
      setAmountError(null)
    }

    if (!bankAccountId) {
      setBankAccountError('Please select a bank account')
      valid = false
    } else {
      setBankAccountError(null)
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const order = await initiateFunding(vaultId, parseFloat(amount), bankAccountId!)
    if (order) {
      setActiveOrder(order)
      setAmount('')
    }
  }

  const displayOrder = activeOrder ?? inProgressOrder ?? null

  if (displayOrder?.paymentInstructions && displayOrder.fees && displayOrder.conversion) {
    return (
      <div className="space-y-4">
        <PaymentStatusTracker order={displayOrder} />
        <PaymentInstructionsDisplay
          instructions={displayOrder.paymentInstructions}
          fees={displayOrder.fees}
          conversion={displayOrder.conversion}
        />
        {(displayOrder.status === 'completed' || displayOrder.status === 'failed' || displayOrder.status === 'expired') && (
          <Button variant="secondary" onClick={() => setActiveOrder(null)}>
            Fund Another Amount
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Fund Vault</h3>

        <Input
          label="Amount (NGN)"
          type="number"
          placeholder={`Min ${MIN_AMOUNT.toLocaleString()} - Max ${MAX_AMOUNT.toLocaleString()}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amountError ?? undefined}
          min={MIN_AMOUNT}
          max={MAX_AMOUNT}
        />

        <BankAccountSelector
          value={bankAccountId}
          onChange={setBankAccountId}
          error={bankAccountError ?? undefined}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" isLoading={isProcessing} className="w-full">
          Initiate Deposit
        </Button>
      </form>
    </Card>
  )
}
