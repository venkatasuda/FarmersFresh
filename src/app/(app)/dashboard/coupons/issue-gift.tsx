"use client";

import { useState, useTransition } from "react";
import { issueGiftCard } from "./actions";

/**
 * Issue a gift card. The value becomes redeemable loyalty points once the
 * recipient enters the code in their account. Sold at the counter or gifted.
 */
export function IssueGiftCard() {
  const [value, setValue] = useState("500");
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    setCode(null);
    startTransition(async () => {
      const r = await issueGiftCard(Number.parseFloat(value) || 0);
      if (r.ok) setCode(r.code ?? null);
      else setError(r.message ?? "Couldn't issue.");
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Issue a gift card</h2>
      <div className="mt-3 flex items-end gap-2">
        <label className="block">
          <span className="text-xs text-ink-soft">Value (₹)</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-32 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "…" : "Issue card"}
        </button>
      </div>
      {code ? (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Gift card code: <span className="font-mono font-semibold">{code}</span> — give
          this to the customer.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
