"use client";

import { useState, useTransition } from "react";
import { grantPersonalCoupon } from "./actions";

/**
 * Give one customer a personal, single-use coupon — a targeted reward (win a
 * lapsed customer back, apologise for a bad order, thank a regular). It only
 * works for the account tied to that phone, and only that customer sees it.
 */
export function GrantCoupon() {
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("0");
  const [days, setDays] = useState("30");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await grantPersonalCoupon({
        phone,
        kind,
        value: Number.parseFloat(value) || 0,
        minSubtotal: Number.parseFloat(minSubtotal) || 0,
        days: Number.parseInt(days) || 30,
      });
      if (r.ok) {
        setResult(`Sent code ${r.code} to that customer's account.`);
        setPhone("");
      } else setError(r.message ?? "Couldn't grant.");
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Give a customer a coupon</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        A private, single-use code that shows up in that customer&apos;s account.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          placeholder="Customer mobile"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "percent" | "flat")}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="percent">% off</option>
          <option value="flat">₹ off</option>
        </select>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === "percent" ? "10" : "50"}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
        />
        <input
          type="number"
          value={minSubtotal}
          onChange={(e) => setMinSubtotal(e.target.value)}
          placeholder="Min ₹"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Valid days"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {result ? <p className="mt-2 text-sm text-brand-700">{result}</p> : null}
      <button
        type="button"
        disabled={pending || !phone.trim()}
        onClick={submit}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Granting…" : "Grant coupon"}
      </button>
    </section>
  );
}
