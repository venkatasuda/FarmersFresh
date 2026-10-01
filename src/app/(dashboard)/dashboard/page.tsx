import { DashboardPageView } from "@/features/dashboard/overview/overview-view";
import { requireSession } from "@/server/auth/session";
import { getOrders } from "@/server/orders/queries";
import { getDebtors } from "@/server/payments/credit";
import { getBusinessOverview } from "@/server/reporting/overview";

export const metadata = {
  title: "Dashboard · Farmers Fresh",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const [openOrders, debtors, overview] = await Promise.all([
    getOrders(false),
    getDebtors(),
    session.isOwner ? getBusinessOverview() : Promise.resolve(null),
  ]);
  const totalOwed = debtors.reduce((s, d) => s + d.outstanding, 0);

  const farms = session.memberships.filter((m) => m.locationType === "farm");
  const stores = session.memberships.filter((m) => m.locationType === "store");
  const newOrders = openOrders.filter((o) => o.status === "placed");
  const openValue = openOrders.reduce((sum, o) => sum + o.total, 0);

  return <DashboardPageView session={session} overview={overview} openOrders={openOrders} openValue={openValue} newOrders={newOrders} totalOwed={totalOwed} debtors={debtors} farms={farms} stores={stores} />;
}
