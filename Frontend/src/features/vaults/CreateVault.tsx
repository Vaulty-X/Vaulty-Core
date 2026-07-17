'use client'

import { useState, useRef, useEffect } from 'react'
import { useVault } from '@/hooks/useVault'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'

interface FormErrors {
  name?: string
  targetAmount?: string
  lockPeriod?: string
  asset?: string
}

export default function CreateVault() {
  const { createVault, isProcessing, error } = useVault()
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [lockPeriod, setLockPeriod] = useState('')
  const [asset, setAsset] = useState('XLM')
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<FormErrors>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  const validateField = (field: keyof FormErrors, value: string) => {
    let errorMsg: string | undefined
    switch (field) {
      case 'name':
        if (!value.trim()) errorMsg = 'Vault name is required'
        break
      case 'targetAmount':
        const amountNum = parseFloat(value)
        if (!value.trim()) errorMsg = 'Target amount is required'
        else if (isNaN(amountNum)) errorMsg = 'Amount must be a number'
        else if (amountNum <= 0) errorMsg = 'Amount must be greater than zero'
        break
      case 'lockPeriod':
        const periodNum = parseInt(value)
        if (!value.trim()) errorMsg = 'Lock period is required'
        else if (isNaN(periodNum)) errorMsg = 'Lock period must be a number'
        else if (periodNum < 1) errorMsg = 'Lock period must be at least 1 day'
        break
      case 'asset':
        if (!value.trim()) errorMsg = 'Asset is required'
        break
    }
    return errorMsg
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    newErrors.name = validateField('name', name)
    newErrors.targetAmount = validateField('targetAmount', targetAmount)
    newErrors.lockPeriod = validateField('lockPeriod', lockPeriod)
    newErrors.asset = validateField('asset', asset)
    setErrors(newErrors)
    return !Object.values(newErrors).some(Boolean)
  }

  const handleBlur = (field: keyof FormErrors) => {
    setTouched({ ...touched, [field]: true })
    const err = validateField(field,
      field === 'name' ? name :
      field === 'targetAmount' ? targetAmount :
      field === 'lockPeriod' ? lockPeriod : asset
    )
    setErrors({ ...errors, [field]: err })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)
    setFormError(null)

    if (!validateForm()) {
      if (errorSummaryRef.current) {
        errorSummaryRef.current.focus()
      }
      return
    }

    try {
      await createVault({
        name,
        targetAmount: parseFloat(targetAmount),
        currentBalance: 0,
        lockPeriod: parseInt(lockPeriod),
        createdAt: new Date(),
        maturityDate: new Date(Date.now() + parseInt(lockPeriod) * 24 * 60 * 60 * 1000),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create vault'
      setFormError(message)
    }
  }

  useEffect(() => {
    if (error) {
      setFormError(error)
    }
  }, [error])

  const hasErrors = Object.values(errors).some(Boolean) || formError

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-4">Create New Vault</h2>
      
      {formError && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <p className="text-red-700">{formError}</p>
        </div>
      )}

      {hasErrors && isSubmitted && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-live="polite"
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <h3 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.name && <li>{errors.name}</li>}
            {errors.targetAmount && <li>{errors.targetAmount}</li>}
            {errors.lockPeriod && <li>{errors.lockPeriod}</li>}
            {errors.asset && <li>{errors.asset}</li>}
          </ul>
        </div>
      )}

      <Card>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <Input
              label="Vault Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur('name')}
              error={touched.name ? errors.name : undefined}
              helpText="Give your savings goal a name"
              disabled={isProcessing}
            />

            <Input
              label="Target Amount"
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              onBlur={() => handleBlur('targetAmount')}
              error={touched.targetAmount ? errors.targetAmount : undefined}
              helpText="How much do you want to save?"
              disabled={isProcessing}
            />

            <Input
              label="Lock Period (Days)"
              type="number"
              min="1"
              value={lockPeriod}
              onChange={(e) => setLockPeriod(e.target.value)}
              onBlur={() => handleBlur('lockPeriod')}
              error={touched.lockPeriod ? errors.lockPeriod : undefined}
              helpText="Minimum lock period for your savings"
              disabled={isProcessing}
            />

            <div className="w-full">
              <label htmlFor="asset" className="block text-sm font-medium text-slate-700 mb-1">
                Asset
              </label>
              <select
                id="asset"
                value={asset}
                onChange={(e) => {
                  setAsset(e.target.value)
                  handleBlur('asset')
                }}
                onBlur={() => handleBlur('asset')}
                aria-invalid={!!(touched.asset && errors.asset)}
                aria-describedby={touched.asset && errors.asset ? 'asset-error' : undefined}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing}
              >
                <option value="XLM">XLM (Stellar Lumens)</option>
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
              {touched.asset && errors.asset && (
                <p id="asset-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.asset}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                isLoading={isProcessing}
                disabled={isProcessing}
                className="w-full"
              >
                Create Vault
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
