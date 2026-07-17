/**
 * useFeatureFlags
 *
 * Loads regulated feature availability from the backend on mount and writes the
 * result into the Zustand store.  Consumers read `regulatedFeatures` directly
 * from the store rather than from this hook's return value so that any component
 * tree can react to a single, shared source of truth.
 *
 * The API call falls back to env-var defaults inside `apiClient.getFeatureFlags()`
 * (see src/lib/api.ts), so this hook is safe to use in environments without a
 * running backend.
 */

import { useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { useAppStore } from '@/stores'

export function useFeatureFlags() {
  const setRegulatedFeatures = useAppStore((s) => s.setRegulatedFeatures)
  const regulatedFeatures = useAppStore((s) => s.regulatedFeatures)

  useEffect(() => {
    let cancelled = false

    apiClient.getFeatureFlags().then((flags) => {
      if (!cancelled) {
        setRegulatedFeatures(flags)
      }
    })

    return () => {
      cancelled = true
    }
  }, [setRegulatedFeatures])

  return regulatedFeatures
}
