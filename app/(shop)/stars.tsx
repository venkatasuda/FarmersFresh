/**
 * A row of stars for an average rating. Pure SVG, no dependency. Renders
 * partial fill for fractional ratings (4.5 → four and a half). Server-safe.
 */
export function Stars({
  rating,
  className = "size-3.5",
}: {
  rating: number;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i)); // 0..1 for this star
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={className}
            aria-hidden
          >
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
                <stop offset={`${fill * 100}%`} stopColor="#e3ebe6" />
              </linearGradient>
            </defs>
            <path
              d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"
              fill={`url(#star-${i}-${Math.round(fill * 100)})`}
            />
          </svg>
        );
      })}
    </span>
  );
}
