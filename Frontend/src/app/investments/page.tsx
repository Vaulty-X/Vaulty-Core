'use client'

import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import InvestmentPortfolio from '@/features/investments/InvestmentPortfolio'

export default function InvestmentsPage() {
  const { investments } = useFeatureFlags()

  if (!investments) {
    return <InvestmentPortfolio />
  }

  return <InvestmentPortfolio />
}
