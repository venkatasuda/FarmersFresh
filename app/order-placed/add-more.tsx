"use client";

import { useState, useTransition } from "react";
import { addToOrder } from "./add-actions";
import { formatRupees } from "@/lib/format";

type Item = { id: string; name: string; price: number; loose: boolean };

/**
 * "Forgot something?" — add items to a just-placed COD order within the 15-min
 * window. The database enforces the window, ownership and stock; this is a quick
 * one-tap add of a few suggestions.
 */
export function AddMore({
  orderNumber,
  products,
}: {
  orderNumber: string;
  products: Item[];
}) {
  const [pending, startTransition] = useTransition();
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  if (products.length === 0) return null;

  function add(item: Item) {
    setError(null);
    startTransition(async () => {
      const r = await addToOrder(orderNumber, item.id, item.loose ? 0.5 : 1);
      if (r.ok) {
        setTotal(r.total ?? null);
        setAdded((a) => ({ ...a, [item.id]: true }));
      } else setError(r.message ?? "Couldn't add that.");
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-left">
      <p className="text-sm font-medium text-ink">Forgot something?</p>
      <p className="text-xs text-ink-soft">
        Add more in the next 15 minutes — it goes on the same delivery.
      </p>
      <ul className="mt-3 space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink">
              {p.name}{" "}
              <span className="text-ink-soft">
                {formatRupees(p.price)}
                {p.loose ? "/kg" : ""}
              </span>
            </span>
            <button
              type="button"
              disabled={pending || added[p.id]}
              onClick={() => add(p)}
              className="shrink-0 rounded-lg border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
            >
              {added[p.id] ? "Added ✓" : "+ Add"}
            </button>
          </li>
        ))}
      </ul>
      {total !== null ? (
        <p className="mt-2 text-sm text-brand-700">New order total: {formatRupees(total)}</p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
