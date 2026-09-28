"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoAssign, setShift } from "./actions";

export function DeliveryControls({ initialOnShift }: { initialOnShift: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initialOnShift);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setOn(await setShift(!on));
            router.refresh();
          })
        }
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          on
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-line text-ink hover:border-brand-300"
        }`}
      >
        {on ? "On shift ✓" : "Go on shift"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await autoAssign();
            setMsg(r.ok ? `Assigned ${r.count}` : r.message);
            router.refresh();
          })
        }
        className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-brand-300 disabled:opacity-50"
      >
        Auto-assign now
      </button>

      {msg ? <span className="text-sm text-ink-soft">{msg}</span> : null}
      <span className="ml-auto text-xs text-ink-soft">
        Auto-assign also runs every 10 min · same area → same rider. Go on shift to receive orders.
      </span>
    </div>
  );
}
