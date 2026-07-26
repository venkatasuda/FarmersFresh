"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCoupon } from "./actions";

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleCoupon(id, !active);
          router.refresh();
        })
      }
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        active
          ? "bg-brand-100 text-brand-800 hover:bg-brand-200"
          : "bg-zinc-100 text-ink-soft hover:bg-zinc-200"
      }`}
    >
      {active ? "Active" : "Off"}
    </button>
  );
}
