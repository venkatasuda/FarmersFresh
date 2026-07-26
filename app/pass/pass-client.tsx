"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startMembership, type Membership, type Plan } from "./actions";
import { payForMembership } from "@/app/checkout/razorpay";
import { formatRupees } from "@/lib/format";

const ONLINE_ENABLED = Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

const BENEFITS = [
  "Free delivery on every order — no minimum",
  "Member price: an extra discount on your whole basket",
  "Same fresh farm meat, cut to order",
];

export function PassClient({
  plans,
  membership,
}: {
  plans: Plan[];
  membership: Membership;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (membership || done) {
    const m = membership;
    return (
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
        <p className="text-sm text-brand-100">Your membership</p>
        <p className="mt-1 text-2xl font-semibold">{m?.plan ?? "Farmers Fresh Pass"}</p>
        <p className="mt-1 text-sm text-brand-100">
          Active
          {m?.expiresAt
            ? ` until ${new Date(m.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`
            : ""}
          . Free delivery{m?.discountPercent ? ` + ${m.discountPercent}% off every order` : ""}.
        </p>
      </div>
    );
  }

  function buy(plan: Plan) {
    setError(null);
    startTransition(async () => {
      const started = await startMembership(plan.id);
      if (!started.ok) {
        setError(started.message);
        return;
      }
      const r = await payForMembership({
        membershipId: started.membershipId,
        prefill: { name: "", email: "", phone: "" },
      });
      if (r.status === "paid") {
        setDone(true);
        router.refresh();
      } else if (r.status === "error") {
        setError(r.message);
      }
      // dismissed: silently let them retry
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-medium text-ink">What you get</h2>
        <ul className="mt-3 space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-ink">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <svg viewBox="0 0 24 24" fill="none" className="size-3" aria-hidden>
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-medium text-ink">{plan.name}</p>
            <p className="mt-1 text-3xl font-semibold text-ink">
              {formatRupees(plan.price)}
              <span className="ml-1 text-sm font-normal text-ink-soft">
                / {plan.durationDays} days
              </span>
            </p>
            {plan.discountPercent > 0 ? (
              <p className="mt-1 text-sm text-brand-700">
                {plan.discountPercent}% off every order + free delivery
              </p>
            ) : null}
            <button
              type="button"
              disabled={pending || !ONLINE_ENABLED}
              onClick={() => buy(plan)}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Opening payment…" : ONLINE_ENABLED ? "Get the Pass" : "Coming soon"}
            </button>
            {!ONLINE_ENABLED ? (
              <p className="mt-2 text-center text-xs text-ink-soft">
                Online payment isn&apos;t set up yet.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-ink-soft">
        The Pass pays for itself in a few deliveries. Cancel renewal any time — it
        simply lapses at the end of the term.
      </p>
    </div>
  );
}
