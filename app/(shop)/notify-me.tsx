"use client";

import { useState, useTransition } from "react";
import { watchStock } from "./stock-alert-actions";

/**
 * "Notify me when it's back" for a sold-out product. One optional field: a
 * signed-in customer can just tap the button (we use their account email); a
 * guest types an email or mobile. We detect which from the input, so there's a
 * single box instead of two.
 */
export function NotifyMe({ productId }: { productId: string }) {
  const [contact, setContact] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const v = contact.trim();
    const parsed = v.includes("@")
      ? { email: v }
      : /\d/.test(v)
        ? { phone: v }
        : undefined;

    startTransition(async () => {
      const r = await watchStock(productId, parsed);
      if (r.ok) setDone(r.message);
      else setError(r.message);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        {done}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Sold out today</p>
      <p className="mt-0.5 text-xs text-ink-soft">
        Leave your email or mobile and we&apos;ll tell you the moment it&apos;s
        back. If you&apos;re signed in, just tap the button.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email or mobile (optional)"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "…" : "Notify me"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
