'use client'

/**
 * Route-level error boundary (Next.js App Router).
 *
 * Catches errors thrown during client rendering of any page or layout beneath
 * this file's directory.  `global-error.tsx` handles the rare case where the
 * root layout itself throws.
 *
 * Next.js contract:
 *   - Must be a Client Component ('use client').
 *   - Receives `error` (the thrown value, with `digest` for server-side logging)
 *     and `reset` (retries the failed segment).
 *   - The component is re-mounted when `reset` succeeds.
 */

import { useEffect } from 'react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Determine whether the thrown error originates from the Stellar wallet layer.
 * We check `name` rather than `instanceof` because the error crosses the
 * serialisation boundary between the server and the client error boundary.
 */
function isWalletError(error: Error): boolean {
  return error.name === 'WalletConnectionError' || error.name === 'WalletNotConnectedError'
}

function isApiError(error: Error): boolean {
  return error.name === 'ApiError'
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const walletError = isWalletError(error)
  const apiError = isApiError(error)

  useEffect(() => {
    // Log to the browser console in development. In production you would
    // forward `error.digest` to your observability service.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error)
    }
  }, [error])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="error-boundary-container"
    >
      {/* Icon */}
      <div className="error-boundary-icon" aria-hidden="true">
        {walletError ? '🔗' : apiError ? '📡' : '⚠️'}
      </div>

      {/* Heading */}
      <h1 className="error-boundary-heading">
        {walletError
          ? 'Wallet connection problem'
          : apiError
          ? 'We couldn\'t reach the server'
          : 'Something went wrong'}
      </h1>

      {/* Human-readable description */}
      <p className="error-boundary-description">
        {walletError
          ? 'Vaulty couldn\'t connect to your Stellar wallet. Please check that your wallet extension is installed and unlocked, then try again.'
          : apiError
          ? 'There was a problem communicating with the Vaulty server. Check your internet connection and try again.'
          : 'An unexpected error occurred. Your funds are safe — this is only a display issue.'}
      </p>

      {/* Error reference — never expose the raw message or stack trace */}
      {error.digest && (
        <p className="error-boundary-reference">
          Reference: <code>{error.digest}</code>
        </p>
      )}

      {/* Actions */}
      <div className="error-boundary-actions">
        <button
          onClick={reset}
          className="error-boundary-retry-btn"
          type="button"
        >
          Try again
        </button>

        <a href="/" className="error-boundary-home-link">
          Go to home
        </a>
      </div>

      {/* Wallet-specific guidance */}
      {walletError && (
        <aside className="error-boundary-wallet-tips" aria-label="Wallet troubleshooting tips">
          <h2 className="error-boundary-tips-heading">Troubleshooting tips</h2>
          <ul className="error-boundary-tips-list">
            <li>Make sure your wallet browser extension is installed and enabled.</li>
            <li>Unlock your wallet and grant permission when prompted.</li>
            <li>Refresh the page and try connecting again.</li>
            <li>If the issue persists, try a different browser or wallet.</li>
          </ul>
        </aside>
      )}
    </div>
  )
}
