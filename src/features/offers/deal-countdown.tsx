"use client";

import { useEffect, useState } from "react";

/** Live "today's deals end in HH:MM:SS" — a gentle urgency cue on the offers
 *  page, counting down to end of day. Renders after mount to avoid a hydration
 *  mismatch (the server can't know the client clock). */
function msToEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

export function DealCountdown() {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setMs(msToEndOfDay());
    const id = window.setInterval(() => setMs(msToEndOfDay()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (ms === null) return null;
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white">
      <span className="size-2 animate-pulse rounded-full bg-white" />
      Today&apos;s deals end in <span className="font-mono tabular-nums">{clock}</span>
    </div>
  );
}
