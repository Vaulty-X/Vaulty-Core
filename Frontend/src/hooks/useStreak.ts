// ─────────────────────────────────────────────────────────────────────────────
// useStreak / useDisciplineScore – server-state hooks for gamification data
//
// Both hooks follow the same pattern as useVault:
//  • Disabled when no wallet is connected.
//  • Stale after 30 s, GC'd after 5 min.
//  • Invalidated by deposit mutations in useVault.ts.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { fetchStreak, fetchDisciplineScore, fetchAchievements } from '@/lib/api'
import { useAppStore, selectPublicKey } from '@/stores'
import {
  queryKeys,
  type Streak,
  type DisciplineScore,
  type Achievement,
} from '@/types'

/** Returns the saving streak for the currently connected wallet. */
export function useStreak(): UseQueryResult<Streak, Error> {
  const publicKey = useAppStore(selectPublicKey)

  return useQuery({
    queryKey: queryKeys.streak(publicKey ?? ''),
    queryFn: () => fetchStreak(publicKey!),
    enabled: !!publicKey,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  })
}

/** Returns the discipline score for the currently connected wallet. */
export function useDisciplineScore(): UseQueryResult<DisciplineScore, Error> {
  const publicKey = useAppStore(selectPublicKey)

  return useQuery({
    queryKey: queryKeys.disciplineScore(publicKey ?? ''),
    queryFn: () => fetchDisciplineScore(publicKey!),
    enabled: !!publicKey,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  })
}

/** Returns all achievements (locked and unlocked) for the currently connected wallet. */
export function useAchievements(): UseQueryResult<Achievement[], Error> {
  const publicKey = useAppStore(selectPublicKey)

  return useQuery({
    queryKey: queryKeys.achievements(publicKey ?? ''),
    queryFn: () => fetchAchievements(publicKey!),
    enabled: !!publicKey,
    staleTime: 60_000,      // Achievements change less frequently – 1 min.
    gcTime: 10 * 60 * 1000, // 10 min
    retry: 2,
  })
}
