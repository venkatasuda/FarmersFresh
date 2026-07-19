import Link from "next/link";
import { Leaf } from "@/app/brand";

// A branded 404. The default Next.js one is a black-on-white "404" — fine for
// a demo, wrong for a shop. This keeps a lost visitor in the store.
export const metadata = { title: "Not found · Farmers Fresh" };

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-20">
      <div className="text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <Leaf className="size-8" />
        </span>
        <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">
          404
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          We couldn&apos;t find that
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          The page may have moved, or the item may be off the shelf. Everything
          we&apos;re selling today is on the shop.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
