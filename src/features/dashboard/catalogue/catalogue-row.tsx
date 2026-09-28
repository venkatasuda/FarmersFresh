"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { togglePublished } from "./actions";
import { formatRupees } from "@/lib/format";
import { packLabel, type AdminProduct } from "@/lib/types";

export function CatalogueRow({
  product,
  categoryName,
}: {
  product: AdminProduct;
  categoryName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(product.isPublished);

  const pack = packLabel(product);
  const out = product.onHand <= 0;

  function toggle() {
    setError(null);
    const next = !live;
    // Optimistic: flipping a switch should feel instant. Reverted below if
    // the database refuses (e.g. publishing something with no price).
    setLive(next);
    startTransition(async () => {
      const r = await togglePublished(product.id, next);
      if (!r.ok) {
        setLive(!next);
        setError(r.message);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-brand-50">
        {product.imagePath ? (
          <Image
            src={product.imagePath}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-ink-soft">
            No photo
          </span>
        )}
      </div>

      <div className="min-w-40 flex-1">
        <Link
          href={`/dashboard/catalogue/${product.id}`}
          className="font-medium text-ink hover:text-brand-700"
        >
          {product.name}
        </Link>
        <p className="text-xs text-ink-soft">
          {categoryName}
          {pack ? ` · ${pack}` : " · by weight"}
        </p>
        {error ? (
          <p role="alert" className="mt-0.5 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="w-24 text-right">
        <p className="font-medium text-ink tabular-nums">
          {product.salePrice === null ? (
            <span className="text-amber-700">No price</span>
          ) : (
            formatRupees(product.salePrice)
          )}
        </p>
      </div>

      <div className="w-20 text-right">
        <p
          className={`text-sm tabular-nums ${out ? "text-red-600" : "text-ink-soft"}`}
        >
          {product.onHand}
        </p>
        <p className="text-[10px] text-ink-soft">on hand</p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={live}
        title={live ? "Showing on the shop" : "Hidden from the shop"}
        className={`w-24 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          live
            ? "bg-brand-100 text-brand-800 hover:bg-brand-200"
            : "bg-zinc-100 text-ink-soft hover:bg-zinc-200"
        }`}
      >
        {live ? "On shop" : "Hidden"}
      </button>

      <Link
        href={`/dashboard/catalogue/${product.id}`}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        Edit
      </Link>
    </li>
  );
}
