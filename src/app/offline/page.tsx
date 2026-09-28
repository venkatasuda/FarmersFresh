import { Leaf } from "@/app/brand";

export const metadata = { title: "Offline · Farmers Fresh" };

// Shown by the service worker when a page is requested with no connection.
export default function OfflinePage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-20">
      <div className="text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <Leaf className="size-7" />
        </span>
        <h1 className="text-lg font-semibold text-ink">You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">
          Check your connection and try again. Your basket is saved on this
          device — it&apos;ll be here when you&apos;re back.
        </p>
      </div>
    </div>
  );
}
