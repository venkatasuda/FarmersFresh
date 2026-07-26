"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/report";

/**
 * Dashboard error boundary. A crash in a staff screen (a bad query, a null
 * where one wasn't expected) shows this recoverable card rather than a blank
 * page — so the counter or the order queue is never dead in the water.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "dashboard", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-ink">This screen hit a snag</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Something didn&apos;t load right. Try again — your data is safe, this
          is only the display.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Reload this screen
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
          >
            Dashboard
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
