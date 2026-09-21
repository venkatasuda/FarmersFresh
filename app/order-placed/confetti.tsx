"use client";

import { useEffect, useState } from "react";

type Piece = { left: number; color: string; delay: number; duration: number };

const COLORS = ["#16a34a", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

/**
 * A one-shot confetti burst on order confirmation — a small moment of delight.
 * Pure CSS, no library.
 *
 * The random positions are generated in an effect (after mount), never during
 * render: rendering random values on the server and again on the client would
 * cause a hydration mismatch, and calling Math.random() in render is impure.
 */
export function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.4,
        duration: 2 + Math.random() * 1.5,
      }))
    );
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ff-confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style>{`
        .ff-confetti{position:absolute;top:-14px;width:8px;height:13px;border-radius:2px;
          animation-name:ff-fall;animation-timing-function:linear;animation-iteration-count:1;animation-fill-mode:forwards}
        @keyframes ff-fall{to{transform:translateY(108vh) rotate(600deg);opacity:0}}
      `}</style>
    </div>
  );
}
