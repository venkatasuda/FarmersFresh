import { ShopShell } from "@/app/(shop)/shop-shell";
import { getHampers } from "./actions";
import { HampersBrowser } from "./hampers-browser";

export const metadata = {
  title: "Hampers & kits · Farmers Fresh",
  description: "Ready-made kits and festive hampers — everything for the dish or the occasion, in one tap.",
};
export const dynamic = "force-dynamic";

export default async function HampersPage() {
  const hampers = await getHampers();
  return (
    <ShopShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Kits &amp; festive hampers
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything for the dish or the occasion, bundled — add the whole kit
            to your basket in one tap.
          </p>
        </div>
        <HampersBrowser hampers={hampers} />
      </div>
    </ShopShell>
  );
}
