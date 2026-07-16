'use client'

// ─────────────────────────────────────────────────────────────────────────────
// QueryProvider
//
// Wraps the application with a TanStack Query client.  Kept as a separate
// 'use client' component so that the root layout can remain a server component.
//
// Configuration:
//  • Financial queries (vaults, streak, score) are considered stale after
//    30 s and are garbage-collected after 5 min.
//  • Failed queries are retried up to 2 times with exponential back-off.
//  • Window focus refetch is enabled so balances refresh when the user
//    returns to the tab.
// ─────────────────────────────────────────────────────────────────────────────

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // One QueryClient per browser session.  useState ensures a new client is
  // not created on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30 s default stale time for financial data.
            staleTime: 30_000,
            // Keep unused data for 5 min before garbage collection.
            gcTime: 5 * 60 * 1000,
            // Retry failed requests twice with exponential back-off.
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
            // Refetch when the window regains focus so balances stay current.
            refetchOnWindowFocus: true,
            // Do not refetch on mount if data is still fresh.
            refetchOnMount: true,
          },
          mutations: {
            // Surface mutation errors in the component; no silent swallowing.
            throwOnError: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
