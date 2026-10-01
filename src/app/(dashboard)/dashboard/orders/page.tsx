import { OrdersPageView } from "@/features/dashboard/orders/orders-view";
import { requireSession } from "@/server/auth/session";
import { getOrders } from "@/server/orders/queries";

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

  return <OrdersPageView showAll={showAll} newCount={newCount} orders={orders} />;
}
