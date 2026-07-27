"use client";

/**
 * A one-shot confetti burst on order confirmation — a small moment of delight
 * that makes placing an order feel rewarding. Pure CSS, no library.
 */
export function Confetti() {
  const colors = ["#16a34a", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];
  const pieces = Array.from({ length: 28 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="ff-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.4}s`,
            animationDuration: `${2 + Math.random() * 1.5}s`,
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
