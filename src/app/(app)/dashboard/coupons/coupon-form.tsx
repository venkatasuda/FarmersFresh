"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCoupon } from "./actions";

export function CouponForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [perPhone, setPerPhone] = useState("1");

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createCoupon({
        code,
        kind,
        value: Number.parseFloat(value) || 0,
        maxDiscount:
          kind === "percent" && maxDiscount ? Number.parseFloat(maxDiscount) : null,
        minSubtotal: minSubtotal ? Number.parseFloat(minSubtotal) : 0,
        perPhoneLimit: Number.parseInt(perPhone) || 1,
        usageLimit: null,
        expiresAt: null,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setCode("");
      setValue("");
      setMaxDiscount("");
      setMinSubtotal("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">New coupon</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="FRESH20"
            className={`${inputClass} uppercase`}
          />
        </label>

        <div>
          <span className="text-sm font-medium text-ink">Type</span>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setKind("percent")}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${
                kind === "percent"
                  ? "bg-brand-600 text-white"
                  : "bg-canvas text-ink-soft"
              }`}
            >
              % off
            </button>
            <button
              type="button"
              onClick={() => setKind("flat")}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${
                kind === "flat"
                  ? "bg-brand-600 text-white"
                  : "bg-canvas text-ink-soft"
              }`}
            >
              ₹ off
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">
            {kind === "percent" ? "Percent off" : "Rupees off"}
          </span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "percent" ? "20" : "100"}
            className={inputClass}
          />
        </label>

        {kind === "percent" ? (
          <label className="block">
            <span className="text-sm font-medium text-ink">Max discount (₹)</span>
            <input
              type="number"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="optional cap"
              className={inputClass}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-ink">Min spend (₹)</span>
          <input
            type="number"
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Uses per customer</span>
          <input
            type="number"
            value={perPhone}
            onChange={(e) => setPerPhone(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || !code || !value}
        onClick={submit}
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create coupon"}
      </button>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";
