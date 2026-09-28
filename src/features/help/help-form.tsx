"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createSupportTicket } from "./actions";

export function HelpForm({ loggedIn }: { loggedIn: boolean }) {
  const [subject, setSubject] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft">
        <Link href="/account/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>{" "}
        to message us and see our replies — or reach us on the contact details
        above.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-800">
        {done}
      </div>
    );
  }

  function submit() {
    setError(null);
    if (!subject.trim() || !message.trim()) {
      setError("Add a subject and a message.");
      return;
    }
    startTransition(async () => {
      const r = await createSupportTicket(subject, message, orderNumber);
      if (r.ok) setDone(r.message);
      else setError(r.message);
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Message us</h2>
      <div className="mt-3 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
          placeholder="Order number (if about an order)"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="How can we help?"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}
