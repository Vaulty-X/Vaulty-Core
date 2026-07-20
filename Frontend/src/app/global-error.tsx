'use client';

import { useEffect } from 'react';
// global-error replaces the root layout entirely when it triggers, so it
// must bring its own <html>/<body> and re-import global styles directly
// rather than relying on layout.tsx still being mounted.
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root layout error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex items-center justify-center p-4">
        <div
          role="alert"
          aria-live="assertive"
          className="card max-w-md w-full text-center space-y-4"
        >
          <div aria-hidden="true" className="text-4xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold">Vaulty hit a snag</h1>
          <p className="text-slate-600">
            Something went wrong loading the app. Your wallet and funds are unaffected — nothing
            here can move your assets. Reloading usually fixes it.
          </p>

          {error.digest && (
            <p className="text-xs text-slate-400">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}

          <button type="button" onClick={() => reset()} autoFocus className="btn-primary">
            Reload Vaulty
          </button>
        </div>
      </body>
    </html>
  );
}
