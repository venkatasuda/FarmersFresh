"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/app/(shop)/cart-context";
import { getHamperDetail, type HamperCard, type HamperDetail } from "./actions";
import { formatRupees } from "@/lib/format";

export function HampersBrowser({ hampers }: { hampers: HamperCard[] }) {
  const [open, setOpen] = useState<HamperDetail | null>(null);
  const [, startTransition] = useTransition();

  if (hampers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
        No kits right now — check back soon.
      </p>
    );
  }

  function view(id: string) {
    startTransition(async () => setOpen(await getHamperDetail(id)));
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hampers.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => view(h.id)}
            className="overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-brand-300"
          >
            {h.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.imagePath} alt="" className="h-32 w-full object-cover" />
            ) : (
              <div className="h-32 w-full bg-gradient-to-br from-amber-100 to-amber-200" />
            )}
            <div className="p-4">
              <p className="font-medium text-ink">{h.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{h.itemCount} items</p>
              <p className="mt-1 text-lg font-semibold text-ink">{formatRupees(h.cost)}</p>
            </div>
          </button>
        ))}
      </div>
      {open ? <HamperModal detail={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function HamperModal({ detail, onClose }: { detail: HamperDetail; onClose: () => void }) {
  const { add, openDrawer } = useCart();
  const total = detail.items.reduce((s, i) => s + i.lineCost, 0);

  function addAll() {
    for (const i of detail.items) {
      add(
        {
          productId: i.productId,
          slug: i.slug,
          name: i.name,
          unit: i.unit,
          price: i.price,
          imagePath: i.imagePath,
          packLabel: null,
          step: i.unit === "kg" ? 0.5 : 1,
        },
        i.qty
      );
    }
    onClose();
    openDrawer();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{detail.name}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">✕</button>
        </div>
        {detail.description ? <p className="mt-1 text-sm text-ink-soft">{detail.description}</p> : null}
        <ul className="mt-4 divide-y divide-line">
          {detail.items.map((i) => (
            <li key={i.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">
                {i.name} <span className="text-ink-soft">{i.qty}{i.unit === "kg" ? " kg" : "×"}</span>
              </span>
              <span className="tabular-nums text-ink-soft">{formatRupees(i.lineCost)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="font-medium text-ink">Kit total</span>
          <span className="text-lg font-semibold text-ink tabular-nums">{formatRupees(total)}</span>
        </div>
        <button
          type="button"
          onClick={addAll}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add the whole kit to basket
        </button>
      </div>
    </div>
  );
}
