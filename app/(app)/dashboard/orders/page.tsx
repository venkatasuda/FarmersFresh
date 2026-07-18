import Link from "next/link";
import { OrderCard } from "./order-card";
import { getOrders } from "@/lib/orders";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Orders · Farmers Fresh" };

// Orders change constantly and staff are watching this screen — never serve
// a cached copy.
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireSession();
  const { all } = await searchParams;
  const showAll = all === "1";

  const orders = await getOrders(showAll);
  const newCount = orders.filter((o) => o.status === "placed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Orders
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {showAll
              ? "Everything, newest first"
              : "Open orders — delivered and cancelled are hidden"}
            {newCount > 0 ? (
              <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                {newCount} new
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <Link
            href="/dashboard/orders"
            className={`rounded-lg px-3 py-1.5 ${
              showAll
                ? "border border-line text-ink-soft"
                : "bg-brand-600 text-white"
            }`}
          >
            Open
          </Link>
          <Link
            href="/dashboard/orders?all=1"
            className={`rounded-lg px-3 py-1.5 ${
              showAll
                ? "bg-brand-600 text-white"
                : "border border-line text-ink-soft"
            }`}
          >
            All
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <h2 className="text-lg font-medium text-ink">
            {showAll ? "No orders yet" : "Nothing waiting"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            {showAll
              ? "When a customer orders from the shop, it lands here."
              : "Every order has been delivered or cancelled. Good day."}
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:border-brand-300 hover:text-brand-700"
          >
            View the shop
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      {/* No live push yet — say so rather than let staff assume it updates. */}
      <p className="text-center text-xs text-ink-soft">
        This page does not refresh by itself yet. Reload to see new orders.
      </p>
    </div>
  );
}
