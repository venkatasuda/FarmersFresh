import { PosTerminal } from "./pos-terminal";
import { requireSession } from "@/lib/auth";
import { getPosProducts } from "@/lib/pos";

export const metadata = { title: "Counter · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const session = await requireSession();

  // The till belongs to a store. Pick the caller's first store membership;
  // an owner falls back to the storefront's dispatch store.
  const store = session.memberships.find((m) => m.locationType === "store");
  const locationId = store?.locationId ?? null;

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">No store assigned</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          The counter needs a store. Ask the owner to add you to one.
        </p>
      </div>
    );
  }

  const products = await getPosProducts();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Counter
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Walk-in sales. Every sale draws from the same stock the shop sells
          from, so online stays accurate.
        </p>
      </div>

      <PosTerminal products={products} locationId={locationId} />
    </div>
  );
}
