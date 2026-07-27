"use client";

import { useState } from "react";
import type { MyCoupon } from "./coupon-actions";
import { formatRupees } from "@/lib/format";

function terms(c: MyCoupon): string {
  const off = c.kind === "percent" ? `${c.value}% off` : `${formatRupees(c.value)} off`;
  const cap = c.kind === "percent" && c.maxDiscount ? ` (up to ${formatRupees(c.maxDiscount)})` : "";
  const min = c.minSubtotal > 0 ? ` on orders over ${formatRupees(c.minSubtotal)}` : "";
  return `${off}${cap}${min}`;
}

export function MyCoupons({ coupons }: { coupons: MyCoupon[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (coupons.length === 0) return null;

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(code);
        window.setTimeout(() => setCopied(null), 1500);
      },
      () => {}
    );
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        Your coupons
      </h2>
      <ul className="space-y-2">
        {coupons.map((c) => (
          <li
            key={c.code}
            className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-4"
          >
            <div>
              <p className="font-mono text-lg font-semibold tracking-wider text-brand-800">
                {c.code}
              </p>
              <p className="text-xs text-brand-700">
                {terms(c)}
                {c.expiresAt
                  ? ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copy(c.code)}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              {copied === c.code ? "Copied!" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
