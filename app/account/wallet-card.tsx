"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemReferral, type Wallet } from "./wallet-actions";
import { formatRupees } from "@/lib/format";

/**
 * Wallet + referral card on the account page. Shows the balance, the customer's
 * own referral code to share, and — if they haven't used one — a box to redeem
 * a friend's code for ₹50.
 */
export function WalletCard({ wallet }: { wallet: Wallet }) {
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
      <p className="text-sm text-brand-100">Wallet balance</p>
      <p className="mt-0.5 text-3xl font-semibold">
        {formatRupees(wallet.balance)}
      </p>
      <p className="mt-1 text-xs text-brand-100">
        Earn 2% back on every delivered order. Spend it at checkout.
      </p>

      <div className="mt-4 rounded-xl bg-white/10 p-3">
        <p className="text-xs text-brand-100">Your referral code</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-lg font-semibold tracking-wider">
            {wallet.code}
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-brand-800"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-1 text-xs text-brand-100">
          Share it — your friend gets ₹50, and so do you on their first order.
        </p>
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
