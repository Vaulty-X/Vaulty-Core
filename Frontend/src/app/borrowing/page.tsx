'use client'

import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import BorrowingInterface from '@/features/borrowing/BorrowingInterface'

export default function BorrowingPage() {
  const { borrowing } = useFeatureFlags()

  if (!borrowing) {
    return <BorrowingInterface />
  }

  return <BorrowingInterface />
}
