"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { collectPayment } from "./actions";
import { formatRupees } from "@/lib/format";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank" },
];

export function CollectForm({
  customerId,
  outstanding,
}: {
  customerId: string;
  outstanding: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function submit() {
    setError(null);
    setOkMsg(null);
    const value = Number.parseFloat(amount);

    startTransition(async () => {
      const r = await collectPayment(customerId, value, method, "");
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAmount("");
      setOkMsg(
        r.outstanding > 0
          ? `Recorded. Still owes ${formatRupees(r.outstanding)}.`
          : "Recorded. Account cleared."
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Take a payment</h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-ink-soft">Amount received (₹)</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={outstanding > 0 ? outstanding.toFixed(0) : "0"}
            className="mt-1 w-36 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm tabular-nums outline-none focus:border-brand-500"
          />
        </label>

        <div className="flex gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                method === m.value
                  ? "bg-brand-600 text-white"
                  : "bg-canvas text-ink-soft hover:bg-brand-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={pending || !amount}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record payment"}
        </button>
      </div>

      {outstanding > 0 ? (
        <button
          type="button"
          onClick={() => setAmount(outstanding.toFixed(0))}
          className="mt-2 text-xs text-brand-700 hover:underline"
        >
          Settle full balance ({formatRupees(outstanding)})
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {okMsg ? <p className="mt-2 text-sm text-brand-700">{okMsg}</p> : null}
    </div>
  );
}
