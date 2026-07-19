'use client'

import { useAppStore } from '@/stores'
import { Card } from '@/components/Card'

export default function InvestmentPortfolio() {
  const { investments } = useAppStore((s) => s.regulatedFeatures)

  if (!investments) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Investment Portfolios
              </h2>
              <p className="text-slate-600 mb-2">
                This feature is not yet available in your region.
              </p>
              <p className="text-sm text-slate-500">
                Investment products require eligibility verification and
                post-legal-review approval (Phase 3). No projected returns or
                yield figures are available at this time.
              </p>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h2 className="text-2xl font-bold mb-4">Investment Portfolio</h2>
        <p className="text-slate-600">Investment portfolio coming soon.</p>
      </div>
    </main>
  )
}
