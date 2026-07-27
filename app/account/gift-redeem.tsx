"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemGiftCard } from "./gift-actions";
import { formatRupees } from "@/lib/format";

export function GiftRedeem() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await redeemGiftCard(code.trim());
      if (r.ok) {
        setDone(r.value);
        setCode("");
        router.refresh();
      } else setError(r.message);
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Redeem a gift card</p>
      {done !== null ? (
        <p className="mt-2 text-sm text-brand-700">
          {formatRupees(done)} added to your loyalty points.
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Gift card code"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm uppercase outline-none focus:border-brand-500"
          />
          <button
            type="button"
            disabled={pending || !code.trim()}
            onClick={submit}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "…" : "Redeem"}
          </button>
        </div>
      )}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
