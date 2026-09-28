"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revealScratchCard, type ScratchCard } from "./scratch-actions";

/**
 * The scratch-card reward. One card per delivered order; scratching reveals a
 * few bonus loyalty points, credited server-side. Works through a queue if the
 * customer has more than one waiting. Pure dopamine on top of the points ledger.
 */
export function ScratchCards({ initial }: { initial: ScratchCard[] }) {
  const router = useRouter();
  const [queue] = useState(initial);
  const [index, setIndex] = useState(0);
  const [won, setWon] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const card = queue[index];
  if (!card) return null;

  function scratch() {
    startTransition(async () => {
      const r = await revealScratchCard(card.id);
      if (r.ok) setWon(r.points);
    });
  }

  function next() {
    setWon(null);
    if (index + 1 < queue.length) setIndex(index + 1);
    else setIndex(queue.length); // exhausts -> card becomes undefined
    router.refresh(); // refresh the points balance shown above
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        You&apos;ve got a reward!
      </h2>

      <div className="overflow-hidden rounded-2xl border border-brand-200">
        <div className="relative flex min-h-40 flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-center text-white">
          {won === null ? (
            <>
              <p className="text-sm text-brand-50">
                A thank-you for order {card.orderNumber}
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={scratch}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-70"
              >
                {pending ? "Scratching…" : "Scratch to reveal"}
              </button>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold">+{won} points</p>
              <p className="text-sm text-brand-50">
                added to your balance{won > 0 ? " — worth ₹" + won : ""}.
              </p>
              <button
                type="button"
                onClick={next}
                className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              >
                {index + 1 < queue.length ? "Next card" : "Nice!"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
