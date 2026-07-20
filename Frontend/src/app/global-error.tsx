'use client'

/**
 * Root-level error boundary (Next.js App Router).
 *
 * Catches errors thrown by the root layout itself — a much rarer case than a
 * route error.  Because the root layout has failed, this component must render
 * a complete HTML document on its own; it cannot rely on the layout's <html>
 * or <body> wrappers.
 *
 * Next.js contract:
 *   - Must be a Client Component ('use client').
 *   - Must render <html> and <body> itself.
 *   - Receives the same `error` / `reset` props as error.tsx.
 */

import { useEffect } from 'react'

interface GlobalErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorBoundary({ error, reset }: GlobalErrorBoundaryProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalErrorBoundary]', error)
    }
  }, [error])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Vaulty — Something went wrong</title>
        {/*
          Inline critical styles so the page is readable even when the CSS
          bundle has not loaded (which may itself be the cause of the error).
        */}
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0c4a6e;
            color: #f0f9ff;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }

          .gb-card {
            background: #075985;
            border: 1px solid #0369a1;
            border-radius: 1rem;
            max-width: 36rem;
            width: 100%;
            padding: 2.5rem 2rem;
            text-align: center;
          }

          .gb-logo {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.05em;
            margin-bottom: 1.5rem;
            color: #38bdf8;
          }

          .gb-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
          }

          .gb-heading {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
          }

          .gb-description {
            font-size: 1rem;
            line-height: 1.6;
            color: #bae6fd;
            margin-bottom: 1.5rem;
          }

          .gb-reference {
            font-size: 0.75rem;
            color: #7dd3fc;
            margin-bottom: 1.5rem;
          }

          .gb-reference code {
            background: #0c4a6e;
            padding: 0.15em 0.4em;
            border-radius: 0.25rem;
            font-family: monospace;
          }

          .gb-actions {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            align-items: center;
          }

          @media (min-width: 400px) {
            .gb-actions { flex-direction: row; justify-content: center; }
          }

          .gb-retry-btn {
            background: #0284c7;
            color: #fff;
            border: none;
            border-radius: 0.5rem;
            padding: 0.6rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
          }

          .gb-retry-btn:hover { background: #0369a1; }
          .gb-retry-btn:focus-visible {
            outline: 2px solid #38bdf8;
            outline-offset: 2px;
          }

          .gb-home-link {
            color: #7dd3fc;
            font-size: 0.95rem;
            text-decoration: underline;
            text-underline-offset: 2px;
            cursor: pointer;
          }

          .gb-home-link:focus-visible {
            outline: 2px solid #38bdf8;
            outline-offset: 2px;
            border-radius: 0.25rem;
          }
        `}</style>
      </head>
      <body>
        <div
          role="alert"
          aria-live="assertive"
          className="gb-card"
        >
          <div className="gb-logo" aria-label="Vaulty">🔐 Vaulty</div>

          <span className="gb-icon" aria-hidden="true">💥</span>

          <h1 className="gb-heading">Application error</h1>

          <p className="gb-description">
            Vaulty ran into a critical error and couldn&apos;t recover automatically.
            Your funds are safe — this is a display problem only.
            Please try reloading the page.
          </p>

          {error.digest && (
            <p className="gb-reference">
              Reference: <code>{error.digest}</code>
            </p>
          )}

          <div className="gb-actions">
            <button
              onClick={reset}
              className="gb-retry-btn"
              type="button"
            >
              Reload app
            </button>

            <a href="/" className="gb-home-link">
              Go to home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
