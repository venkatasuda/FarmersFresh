import { StockRow } from "./stock-row";
import { requireSession } from "@/lib/auth";
import { formatQty } from "@/lib/format";
import {
  getRecentMovements,
  getStockLines,
  getStorefrontLocationId,
} from "@/lib/stock";
import { LOW_STOCK_KG, STOCK_REASON_LABELS } from "@/lib/types";

export const metadata = { title: "Stock · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireSession();

  const [lines, movements, locationId] = await Promise.all([
    getStockLines(),
    getRecentMovements(20),
    getStorefrontLocationId(),
  ]);

  const out = lines.filter((l) => l.onHand <= 0);
  const low = lines.filter((l) => l.onHand > 0 && l.onHand < LOW_STOCK_KG);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Stock</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What the shop can sell right now. Anything at zero disappears from the
          storefront automatically.
        </p>
      </div>

      {out.length > 0 || low.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {out.length > 0 ? (
            <p>
              <strong>{out.map((l) => l.name).join(", ")}</strong>{" "}
              {out.length === 1 ? "is" : "are"} sold out and hidden from
              customers.
            </p>
          ) : null}
          {low.length > 0 ? (
            <p className={out.length > 0 ? "mt-1" : ""}>
              Running low: {low.map((l) => l.name).join(", ")}.
            </p>
          ) : null}
        </div>
      ) : null}

      {!locationId ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <h2 className="text-lg font-medium text-ink">
            No dispatch store set
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            The storefront doesn&apos;t know which store it sells from, so stock
            can&apos;t be counted. Set{" "}
            <code className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">
              organizations.storefront_location_id
            </code>
            .
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <h2 className="border-b border-line bg-brand-50/60 px-5 py-3 text-sm font-medium text-brand-900">
            On hand
          </h2>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <StockRow key={l.productId} line={l} locationId={locationId} />
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Recent movements
        </h2>

        {movements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{m.productName}</span>
                  <span className="ml-2 text-ink-soft">
                    {STOCK_REASON_LABELS[m.reason] ?? m.reason}
                  </span>
                  {m.note ? (
                    <span className="ml-2 text-xs text-ink-soft">
                      — {m.note}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-medium tabular-nums ${
                      m.delta > 0 ? "text-brand-700" : "text-red-600"
                    }`}
                  >
                    {m.delta > 0 ? "+" : "−"}
                    {formatQty(Math.abs(m.delta), "kg")}
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs text-ink-soft">
                    {new Date(m.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        Stock is a ledger — every row above is permanent. Corrections are made
        by adding an opposing entry, never by editing history.
      </p>
    </div>
  );
}
