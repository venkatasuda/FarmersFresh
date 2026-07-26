"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitReview } from "./review-actions";

/**
 * Write-a-review form. A star picker, name, optional text, and an optional
 * phone/email — which is used only to mark the review a "verified purchase"
 * and to stop duplicates (stored hashed, never shown). Collapsed behind a
 * button so it doesn't dominate the product page.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verified: boolean } | null>(null);

  // The product slug isn't needed for the RPC, but revalidatePath wants a path;
  // deriving it from the URL keeps this component prop-light.
  function slugFromPath() {
    if (typeof window === "undefined") return "";
    const m = window.location.pathname.match(/\/shop\/([^/?#]+)/);
    return m ? m[1] : "";
  }

  function submit() {
    setError(null);
    if (rating < 1) {
      setError("Tap the stars to rate.");
      return;
    }
    startTransition(async () => {
      const r = await submitReview(
        productId,
        slugFromPath(),
        name,
        rating,
        body,
        contact
      );
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDone({ verified: r.verified });
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Thanks for your review!
        {done.verified ? " (verified purchase)" : ""}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        Write a review
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-7"
              fill={(hover || rating) >= n ? "#f59e0b" : "#e3ebe6"}
            >
              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
            </svg>
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="How was it? (optional)"
          className={inputClass}
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone or email you ordered with (optional)"
          className={inputClass}
        />
        <p className="text-xs text-ink-soft">
          Your phone/email is used only to mark a verified purchase — never
          shown, stored securely.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500";
