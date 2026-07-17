'use client'

import { useState, useRef, useEffect } from 'react'
import { useVault } from '@/hooks/useVault'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { WithdrawalOrder } from '@/types'
import { Input } from './Input'
import { Button } from './Button'
import { Card } from './Card'
import { BankAccountSelector } from './BankAccountSelector'
import { PaymentStatusTracker } from './PaymentStatusTracker'
import { FeeInfo, ConversionInfo } from '@/types'

const MIN_AMOUNT = 1000
const MAX_AMOUNT = 5_000_000

interface WithdrawalFlowProps {
  vaultId: string
  vaultBalance: number
}

export function WithdrawalFlow({ vaultId, vaultBalance }: WithdrawalFlowProps) {
  const { initiateWithdrawal, isProcessing, error } = useVault()
  const { withdrawalOrders } = usePaymentStatus()
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [bankAccountError, setBankAccountError] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<WithdrawalOrder | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const statusAnnounceRef = useRef<HTMLDivElement>(null)

  const vaultWithdrawalOrders = withdrawalOrders.filter((o) => o.vaultId === vaultId)
  const inProgressOrder = vaultWithdrawalOrders.find(
    (o) => o.status !== 'completed' && o.status !== 'failed' && o.status !== 'expired'
  )

  const validate = (): boolean => {
    let valid = true

    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount)) {
      setAmountError('Please enter a valid amount')
      valid = false
    } else if (numAmount < MIN_AMOUNT) {
      setAmountError(`Minimum withdrawal is NGN ${MIN_AMOUNT.toLocaleString()}`)
      valid = false
    } else if (numAmount > MAX_AMOUNT) {
      setAmountError(`Maximum withdrawal is NGN ${MAX_AMOUNT.toLocaleString()}`)
      valid = false
    } else if (numAmount > vaultBalance) {
      setAmountError(`Insufficient vault balance. Available: NGN ${vaultBalance.toLocaleString()}`)
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

    const order = await initiateWithdrawal(vaultId, parseFloat(amount), bankAccountId!)
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

  if (displayOrder && displayOrder.fees && displayOrder.conversion) {
    return (
      <div className="space-y-4">
        <div
          ref={statusAnnounceRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {`Withdrawal status: ${displayOrder.status}`}
        </div>
        <PaymentStatusTracker order={displayOrder} />
        <WithdrawalReceipt
          amount={displayOrder.amount}
          fees={displayOrder.fees}
          conversion={displayOrder.conversion}
        />
        {(displayOrder.status === 'completed' || displayOrder.status === 'failed' || displayOrder.status === 'expired') && (
          <Button variant="secondary" onClick={() => setActiveOrder(null)}>
            Withdraw Another Amount
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h3 className="text-lg font-semibold text-slate-900">Withdraw from Vault</h3>

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

        <div className="text-sm text-slate-500">
          Available balance: <span className="font-semibold text-slate-900">NGN {vaultBalance.toLocaleString()}</span>
        </div>

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
          max={Math.min(MAX_AMOUNT, vaultBalance)}
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
          Initiate Withdrawal
        </Button>
      </form>
    </Card>
  )
}

function WithdrawalReceipt({
  amount,
  fees,
  conversion,
}: {
  amount: number
  fees: FeeInfo
  conversion: ConversionInfo
}) {
  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Withdrawal Receipt</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Withdrawal amount</span>
          <p className="font-medium text-slate-900">{conversion.inputCurrency} {amount.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-slate-500">You receive</span>
          <p className="font-medium text-primary-700">
            {conversion.outputCurrency} {conversion.outputAmount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Fee Breakdown</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Platform fee</span>
            <span className="text-slate-700">{fees.currency} {fees.platformFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Network fee</span>
            <span className="text-slate-700">{fees.currency} {fees.networkFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium col-span-2 border-t border-slate-200 pt-2">
            <span className="text-slate-700">Total fee</span>
            <span className="text-slate-900">{fees.currency} {fees.totalFee.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Conversion</h4>
        <div className="text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Exchange rate</span>
            <span className="text-slate-700">1 {conversion.inputCurrency} = {conversion.exchangeRate} {conversion.outputCurrency}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
