import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vaulty — Save Consistently. Grow Your Wealth.',
  description: 'A non-custodial decentralized savings platform on the Stellar network. Save consistently, track streaks, and grow your wealth.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
