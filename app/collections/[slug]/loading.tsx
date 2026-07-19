import { ProductGridSkeleton } from "@/app/(shop)/product-skeleton";

export default function CollectionLoading() {
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
        <div className="mb-2 h-4 w-32 animate-pulse rounded bg-line" />
        <div className="mb-5 h-7 w-48 animate-pulse rounded bg-line" />
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
