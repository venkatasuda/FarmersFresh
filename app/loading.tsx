import { ProductGridSkeleton } from "@/app/(shop)/product-skeleton";

/**
 * Shown while the homepage's server data loads. Includes a header-bar
 * placeholder because the real header (ShopShell) is rendered inside the page,
 * not in a layout — so it isn't present during this fallback. Mimicking its
 * shape keeps the load from looking broken.
 */
export default function HomeLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <div className="h-9 bg-brand-800" />
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <div className="size-9 animate-pulse rounded-xl bg-brand-100" />
          <div className="h-10 flex-1 animate-pulse rounded-full bg-line" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-brand-100" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-8 h-40 animate-pulse rounded-3xl bg-brand-100" />
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-line" />
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
