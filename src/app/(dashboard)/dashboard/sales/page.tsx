import { SalesPageView } from "@/features/dashboard/sales/sales-view";
import { requireSession } from "@/server/auth/session";
import { getDemandInsights, getSalesSummary } from "@/server/reporting/sales";

export const metadata = { title: "Sales · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await requireSession();

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Sales figures are visible to the account owner.
        </p>
      </div>
    );
  }

  const [s, insights] = await Promise.all([
    getSalesSummary(),
    getDemandInsights(),
  ]);
  if (!s) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">No figures yet</h1>
      </div>
    );
  }

  const methodTotal = s.methodSplit.reduce((sum, m) => sum + m.amount, 0);

  return <SalesPageView s={s} methodTotal={methodTotal} insights={insights} />;
}
