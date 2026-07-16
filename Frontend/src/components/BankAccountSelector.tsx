'use client'

import { useAppStore } from '@/stores'
import { BankAccount } from '@/types'

interface BankAccountSelectorProps {
  value: string | null
  onChange: (bankAccountId: string) => void
  error?: string
}

export function BankAccountSelector({ value, onChange, error }: BankAccountSelectorProps) {
  const bankAccounts = useAppStore((s) => s.bankAccounts)

  if (bankAccounts.length === 0) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Bank Account
        </label>
        <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
          No bank accounts linked. Please add one from your profile settings.
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Bank Account
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      >
        <option value="" disabled>
          Select a bank account
        </option>
        {bankAccounts.map((account: BankAccount) => (
          <option key={account.id} value={account.id}>
            {account.bankName} - {account.accountNumber} ({account.accountName})
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
