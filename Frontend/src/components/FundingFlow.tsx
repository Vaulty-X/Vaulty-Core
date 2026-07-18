'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const statusAnnounceRef = useRef<HTMLDivElement>(null)

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
    setIsSubmitted(true)
    setFormError(null)

    if (!validate()) {
      if (errorSummaryRef.current) {
        errorSummaryRef.current.focus()
      }
      return
    }

    const order = await initiateFunding(vaultId, parseFloat(amount), bankAccountId!)
    if (order) {
      setActiveOrder(order)
      setAmount('')
    }
  }

  useEffect(() => {
    if (error) {
      setFormError(error)
    }
  }, [error])

  const displayOrder = activeOrder ?? inProgressOrder ?? null
  const hasErrors = amountError || bankAccountError || formError

  if (displayOrder?.paymentInstructions && displayOrder.fees && displayOrder.conversion) {
    return (
      <div className="space-y-4">
        <div
          ref={statusAnnounceRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {`Deposit status: ${displayOrder.status}`}
        </div>
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
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h3 className="text-lg font-semibold text-slate-900">Fund Vault</h3>

        {hasErrors && isSubmitted && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-live="polite"
            className="p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <h4 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h4>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              {amountError && <li>{amountError}</li>}
              {bankAccountError && <li>{bankAccountError}</li>}
              {formError && <li>{formError}</li>}
            </ul>
          </div>
        )}

        <Input
          label="Amount (NGN)"
          type="number"
          step="0.01"
          placeholder={`Min ${MIN_AMOUNT.toLocaleString()} - Max ${MAX_AMOUNT.toLocaleString()}`}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            if (isSubmitted) validate()
          }}
          onBlur={() => {
            if (isSubmitted) validate()
          }}
          error={amountError ?? undefined}
          min={MIN_AMOUNT}
          max={MAX_AMOUNT}
          disabled={isProcessing}
        />

        <BankAccountSelector
          value={bankAccountId}
          onChange={(id) => {
            setBankAccountId(id)
            if (isSubmitted) validate()
          }}
          error={bankAccountError ?? undefined}
          disabled={isProcessing}
        />

        <Button type="submit" isLoading={isProcessing} className="w-full" disabled={isProcessing}>
          Initiate Deposit
        </Button>
      </form>
    </Card>
  )
}
