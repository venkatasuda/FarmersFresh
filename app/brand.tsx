/**
 * The Farmers Fresh mark — a leaf. Inline SVG rather than an image file so it
 * inherits currentColor, scales without a second network request, and works
 * offline (this app is heading for PWA/offline use at the counter).
 */
export function Leaf({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 4c0 9-5.5 14-12 14a7 7 0 0 1 0-14c4 0 6-2 12 0Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M4 21c3-7 8-11 13-13"
        stroke="currentColor"
        strokeWidth="1.75"
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
