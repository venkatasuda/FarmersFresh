"use client";

import { useState, useTransition } from "react";
import { resolveTicket, type Ticket } from "./actions";

export function SupportList({ rows }: { rows: Ticket[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <h2 className="text-lg font-medium text-ink">No messages</h2>
        <p className="mt-2 text-sm text-ink-soft">Customer questions land here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((t) => (
        <TicketCard key={t.id} t={t} />
      ))}
    </ul>
  );
}

function TicketCard({ t }: { t: Ticket }) {
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve() {
    setError(null);
    startTransition(async () => {
      const r = await resolveTicket(t.id, reply);
      if (!r.ok) setError(r.message ?? "Couldn't resolve.");
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{t.subject}</p>
          <p className="text-xs text-ink-soft">
            {t.orderNumber ? `${t.orderNumber} · ` : ""}
            {new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            t.status === "open" ? "bg-amber-100 text-amber-900" : "bg-brand-100 text-brand-800"
          }`}
        >
          {t.status}
        </span>
      </div>
      <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{t.message}</p>

      {t.status === "open" ? (
        <div className="mt-3 space-y-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply / resolution note (optional)"
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={pending}
            onClick={resolve}
            className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Mark resolved"}
          </button>
        </div>
      ) : t.staffReply ? (
        <p className="mt-2 text-xs text-ink-soft">Reply: {t.staffReply}</p>
      ) : null}
    </li>
  );
}
