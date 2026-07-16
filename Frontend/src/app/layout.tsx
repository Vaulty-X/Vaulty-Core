import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/lib/QueryProvider'

export const metadata: Metadata = {
  title: 'Vaulty — Save Consistently. Grow Your Wealth.',
  description:
    'A non-custodial decentralized savings platform on the Stellar network. Save consistently, track streaks, and grow your wealth.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/*
          QueryProvider is a 'use client' component that sets up the
          TanStack Query client for the entire application.  All server
          state (vaults, streaks, discipline scores) is fetched and
          cached through this provider; Zustand stores only safe UI
          preferences.
        */}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
