'use client'

import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import LendingMarketplace from '@/features/lending/LendingMarketplace'

export default function LendingPage() {
  const { lending } = useFeatureFlags()

  if (!lending) {
    // Feature not yet available — render LendingMarketplace which shows the
    // compliant gated message rather than a hard redirect, so the URL is still
    // shareable and the user gets clear feedback.
    return <LendingMarketplace />
  }

  return <LendingMarketplace />
}
