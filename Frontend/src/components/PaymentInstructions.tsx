'use client'

import { PaymentInstructions as PaymentInstructionsType, FeeInfo, ConversionInfo } from '@/types'
import { Card } from './Card'

interface PaymentInstructionsProps {
  instructions: PaymentInstructionsType
  fees: FeeInfo
  conversion: ConversionInfo
}

export function PaymentInstructionsDisplay({
  instructions,
  fees,
  conversion,
}: PaymentInstructionsProps) {
  const expiresAt = new Date(instructions.expiresAt)
  const isExpired = expiresAt <= new Date()

  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">
        Payment Instructions
      </h3>

      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          This payment request has expired. Please initiate a new deposit.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Bank</span>
          <p className="font-medium text-slate-900">{instructions.bankName}</p>
        </div>
        <div>
          <span className="text-slate-500">Account Name</span>
          <p className="font-medium text-slate-900">{instructions.accountName}</p>
        </div>
        <div>
          <span className="text-slate-500">Account Number</span>
          <p className="font-medium text-slate-900 font-mono">{instructions.accountNumber}</p>
        </div>
        <div>
          <span className="text-slate-500">Amount</span>
          <p className="font-medium text-slate-900">
            {instructions.currency} {instructions.amount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg px-4 py-3">
        <span className="text-sm text-slate-500">Reference</span>
        <p className="font-mono font-semibold text-primary-700 text-lg">
          {instructions.reference}
        </p>
      </div>

      <div className="text-xs text-slate-500">
        Expires: {expiresAt.toLocaleString()}
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
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">You send</span>
            <span className="text-slate-700">
              {conversion.inputCurrency} {conversion.inputAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Exchange rate</span>
            <span className="text-slate-700">1 {conversion.inputCurrency} = {conversion.exchangeRate} {conversion.outputCurrency}</span>
          </div>
          <div className="flex justify-between font-medium col-span-2 border-t border-slate-200 pt-2">
            <span className="text-slate-700">You receive</span>
            <span className="text-primary-700">
              {conversion.outputCurrency} {conversion.outputAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
