"use client";

import { useState, useTransition } from "react";
import { getReceipt, type Receipt } from "./actions";
import { ReceiptView } from "./receipt-view";

/**
 * Guest access to a receipt. A receipt carries the customer's name, address and
 * phone, so we never expose it from just the order number in the URL. Instead —
 * exactly like order tracking — the visitor confirms the phone the order was
 * placed with. The phone is sent in the request body to a server action, never
 * in the URL. Logged-in owners never see this; the server resolves their
 * receipt by account.
 */
export function ReceiptGate({ initialNumber }: { initialNumber?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialNumber ?? "");
  const [phone, setPhone] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await getReceipt(orderNumber.trim(), phone.trim());
      if (!r) {
        setError("We couldn't find a receipt for that order number and phone.");
        return;
      }
      setReceipt(r);
    });
  }

  if (receipt) return <ReceiptView receipt={receipt} />;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-lg font-semibold tracking-tight text-ink">
        View your receipt
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Enter your order number and the phone number you ordered with.
      </p>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-ink">Order number</span>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="FF-000000-0000"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Phone number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="10-digit mobile"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          disabled={pending || !orderNumber.trim() || !phone.trim()}
          onClick={submit}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Finding…" : "View receipt"}
        </button>
      </div>
    </main>
  );
}
