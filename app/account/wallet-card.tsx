"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemReferral, type Wallet } from "./wallet-actions";
import { formatRupees } from "@/lib/format";

/**
 * Loyalty card on the account page — the German-supermarket experience.
 * Shows the points balance (1 point = ₹1), a scannable QR loyalty card the
 * counter staff read to earn/redeem points in store, the customer's referral
 * code to share, and — if they haven't used one — a box to redeem a friend's
 * code for 50 points.
 */
export function WalletCard({
  wallet,
  qrSvg,
}: {
  wallet: Wallet;
  qrSvg: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function copy() {
    navigator.clipboard?.writeText(wallet.code).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  function redeem() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const r = await redeemReferral(code);
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      setMsg(r.message);
      setCode("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-brand-100">Loyalty points</p>
          <p className="mt-0.5 text-3xl font-semibold">
            {Math.floor(wallet.balance)}
            <span className="ml-1 text-base font-normal text-brand-100">
              pts
            </span>
          </p>
          <p className="mt-1 text-xs text-brand-100">
            Worth {formatRupees(Math.floor(wallet.balance))} off. Earn 1 point
            per ₹100 you spend.
          </p>
        </div>

        {/* The scannable loyalty card — staff read this QR at the counter to
            add or redeem points in store, just like Payback / DeutschlandCard. */}
        {qrSvg ? (
          <div className="shrink-0 rounded-xl bg-white p-2">
            <div
              className="size-20 [&>svg]:size-full"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              aria-label="Your loyalty card QR code"
            />
          </div>
        ) : null}
      </div>

      <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-center font-mono text-sm tracking-widest">
        {wallet.code}
      </p>
      <p className="mt-1 text-center text-[11px] text-brand-100">
        Show this at the counter to earn &amp; spend points in store
      </p>

      <div className="mt-4 rounded-xl bg-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-brand-100">
            Refer a friend — you both get 50 points on their first order.
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-brand-800"
          >
            {copied ? "Copied!" : "Share code"}
          </button>
        </div>
      </div>

      {!wallet.referred ? (
        <div className="mt-3">
          <p className="text-xs text-brand-100">Have a friend&apos;s code?</p>
          <div className="mt-1 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="w-full rounded-lg bg-white/15 px-3 py-2 text-sm text-white uppercase placeholder:text-brand-100/70 outline-none"
            />
            <button
              type="button"
              disabled={pending || !code}
              onClick={redeem}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-800 disabled:opacity-60"
            >
              Apply
            </button>
          </div>
          {err ? <p className="mt-1 text-xs text-red-200">{err}</p> : null}
          {msg ? <p className="mt-1 text-xs text-white">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
