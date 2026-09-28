"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/report";

/**
 * Storefront error boundary. If any page under the app root throws while
 * rendering, React unwinds to here and shows this instead of a white screen —
 * the difference between "the site is down" and "one page hiccuped".
 *
 * `reset()` re-renders the failed segment, so a transient error (a dropped
 * database call) recovers on a click without a full reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "storefront", digest: error.digest });
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-20">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path
              d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This page ran into a problem. It&apos;s usually temporary — try again,
          and if it keeps happening, please let us know.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
          >
            Back to shop
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-ink-soft/70">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
