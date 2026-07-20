'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { isApiError } from '@/lib/api';

type ErrorKind = 'wallet' | 'api' | 'app';

function classifyError(error: Error): ErrorKind {
  if (error.name === 'WalletConnectionError') return 'wallet';
  if (isApiError(error)) return 'api';
  return 'app';
}

const COPY: Record<ErrorKind, { icon: string; title: string; description: string; action: string }> = {
  wallet: {
    icon: '🔌',
    title: "We lost the connection to your wallet",
    description:
      "Vaulty couldn't reach your Stellar wallet. Your funds are safe — nothing can move without your wallet's approval.",
    action: 'Reconnect wallet',
  },
  api: {
    icon: '📡',
    title: "We're having trouble reaching Vaulty",
    description:
      "The request to our servers didn't go through. Check your connection and try again in a moment.",
    action: 'Try again',
  },
  app: {
    icon: '⚠️',
    title: 'Something went wrong',
    description:
      "This page ran into an unexpected error. It's been logged on our end — try again, or head back to your vaults.",
    action: 'Try again',
  },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const kind = classifyError(error);
  const copy = COPY[kind];

  useEffect(() => {
    // Full error detail goes to the console/monitoring only — never rendered to the DOM.
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div
        role="alert"
        aria-live="assertive"
        className="card max-w-md w-full text-center space-y-4"
      >
        <div aria-hidden="true" className="text-4xl">
          {copy.icon}
        </div>
        <h1 className="text-xl font-bold text-slate-900">{copy.title}</h1>
        <p className="text-slate-600">{copy.description}</p>

        {error.digest && (
          <p className="text-xs text-slate-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={() => reset()} variant="primary" autoFocus>
            {copy.action}
          </Button>
          <Link href="/" className="btn-secondary inline-flex items-center justify-center">
            Back to Vaults
          </Link>
        </div>
      </div>
    </div>
  );
}
