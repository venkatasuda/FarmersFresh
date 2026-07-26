"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { suggestProducts, type Suggestion } from "./search-actions";
import { formatRupees } from "@/lib/format";

/**
 * Search with live autocomplete, like BigBasket/Amazon: as you type, matching
 * products drop down with image + price. Debounced so it doesn't hit the server
 * on every keystroke. Enter (or "see all") goes to the full results page.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Debounced suggestions.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const r = await suggestProducts(term);
      setItems(r);
      setOpen(true);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(term: string) {
    setOpen(false);
    router.push(term.trim() ? `/search?q=${encodeURIComponent(term.trim())}` : "/");
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="relative"
      >
        <label htmlFor="shop-search" className="sr-only">
          Search products
        </label>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="shop-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder="Search mutton, rice, masala…"
          className="w-full rounded-full border border-line bg-canvas py-2.5 pr-4 pl-9 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:bg-surface"
          autoComplete="off"
        />
      </form>

      {open && items.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          <ul>
            {items.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/shop/${s.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-brand-50"
                >
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                    {s.imagePath ? (
                      <Image src={s.imagePath} alt="" fill sizes="36px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{s.name}</span>
                    {s.category ? (
                      <span className="block text-xs text-ink-soft">{s.category}</span>
                    ) : null}
                  </span>
                  <span className="text-sm font-medium text-ink tabular-nums">
                    {formatRupees(s.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => go(q)}
            className="w-full border-t border-line px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            See all results for &ldquo;{q.trim()}&rdquo;
          </button>
        </div>
      ) : null}
    </div>
  );
}
