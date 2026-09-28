"use client";

import { useEffect, useRef, useState } from "react";
import { checkLocation } from "./location-actions";

const KEY = "ff.location.v1";

type Saved = { pincode: string; area: string | null; served: boolean };

/**
 * The "deliver to" selector, like Swiggy/Zepto's location control at the top.
 * The customer sets their PIN once; it's checked against the delivery zones,
 * remembered on the device, and shown in the header. It also seeds the
 * checkout PIN so a returning customer doesn't retype it.
 *
 * Stored in localStorage, not an account — it works for guests too.
 */
export function LocationPicker() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Close the popover on an outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function submit() {
    setError(null);
    const clean = pin.replace(/\D/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Enter a 6-digit PIN code.");
      return;
    }
    setBusy(true);
    try {
      const r = await checkLocation(clean);
      const next: Saved = { pincode: clean, area: r.area, served: r.served };
      setSaved(next);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setOpen(false);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[9rem] items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-brand-50 sm:max-w-[13rem]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-brand-600" aria-hidden>
          <path
            d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        <span className="min-w-0">
          <span className="block text-[10px] leading-none text-ink-soft">
            Deliver to
          </span>
          <span className="block truncate text-xs font-medium text-ink">
            {saved ? saved.area ?? saved.pincode : "Set location"}
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5 shrink-0 text-ink-soft" aria-hidden>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-40 mt-1 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <p className="text-sm font-medium text-ink">Your delivery area</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Enter your PIN code to check delivery.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 500034"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "…" : "Check"}
            </button>
          </div>
          {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
          {saved ? (
            <p
              className={`mt-2 text-xs ${saved.served ? "text-brand-700" : "text-amber-700"}`}
            >
              {saved.served
                ? `✓ We deliver to ${saved.area ?? saved.pincode}`
                : `We don't deliver to ${saved.pincode} yet`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
