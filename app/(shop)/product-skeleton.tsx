/**
 * A shimmering placeholder card, shown while the catalogue loads. Matches the
 * real ProductCard's shape so the layout doesn't jump when data arrives — the
 * detail that separates a polished app from a janky one.
 */
export function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="aspect-square animate-pulse bg-brand-50" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-line" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-line" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}
