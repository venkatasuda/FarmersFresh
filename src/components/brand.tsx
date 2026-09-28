/**
 * The Farmers Fresh mark — a leaf with a clear central vein. Inline SVG rather
 * than an image file so it inherits currentColor, scales without a second
 * network request, and works offline (this app is heading for PWA/offline use
 * at the counter).
 *
 * A placeholder still — a real brand should commission a proper logo — but a
 * cleaner, more balanced mark than the first pass.
 */
export function Leaf({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* Leaf body */}
      <path
        d="M21 3.5c.6 7-3 15-11 15.2C6 18.8 3 15.6 3 11.4 3 6.9 6.7 3.6 11.6 3.3c3.4-.2 6.6 0 9.4.2Z"
        fill="currentColor"
        opacity="0.92"
      />
      {/* Central vein, cut out for definition */}
      <path
        d="M18.5 6.2C13.5 8 9.2 11.6 6.6 17.4"
        stroke="var(--color-surface, #fff)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Stem */}
      <path
        d="M6.6 17.4 4.2 20.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ subdued = false }: { subdued?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-brand-600">
        <Leaf className="size-5" />
      </span>
      <span
        className={
          subdued
            ? "text-base font-semibold tracking-tight text-ink"
            : "text-lg font-semibold tracking-tight text-ink"
        }
      >
        Farmers<span className="text-brand-600">Fresh</span>
      </span>
    </span>
  );
}
