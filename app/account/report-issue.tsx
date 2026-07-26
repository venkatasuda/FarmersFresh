"use client";

import { useState, useTransition } from "react";
import { requestReturn } from "./return-actions";

/**
 * "Report an issue" on a delivered order — the entry to the returns flow. Kept
 * behind a link so it doesn't clutter the order card; expands to a short reason
 * box. Staff pick it up from their returns queue and refund to points.
 */
export function ReportIssue({ orderNumber }: { orderNumber: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <p className="mt-2 text-xs text-brand-700">{done}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-ink-soft hover:text-brand-700 hover:underline"
      >
        Report an issue
      </button>
    );
  }

  function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("Please tell us what went wrong.");
      return;
    }
    startTransition(async () => {
      const r = await requestReturn(orderNumber, reason.trim());
      if (r.ok) setDone(r.message);
      else setError(r.message);
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-line p-2.5">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="What went wrong? (missing item, quality, wrong item…)"
        className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-soft"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
