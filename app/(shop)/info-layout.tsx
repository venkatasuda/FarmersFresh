import { ShopShell } from "./shop-shell";

/**
 * Shared frame for the static info pages (delivery, contact, refunds, about,
 * privacy). One column, readable measure. These pages are plain content, so
 * they don't need their own chrome — just the shop shell and a title.
 */
export function InfoPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <ShopShell>
      <article className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {updated ? (
          <p className="mt-1 text-sm text-ink-soft">Last updated {updated}</p>
        ) : null}
        <div className="mt-6 space-y-4 text-ink-soft [&_a]:text-brand-700 [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_strong]:text-ink">
          {children}
        </div>
      </article>
    </ShopShell>
  );
}
