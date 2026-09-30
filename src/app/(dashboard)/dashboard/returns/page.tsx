import { getReturns } from "@/server/orders/staff-returns";
import { ReturnsPageView } from "@/features/dashboard/returns/returns-view";
import { requireSession } from "@/server/auth/session";

export const metadata = { title: "Returns · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireSession();
  const { all } = await searchParams;
  const showAll = all === "1";
  const rows = await getReturns(showAll);
  const open = rows.filter((r) => r.status === "requested").length;

  return <ReturnsPageView showAll={showAll} open={open} rows={rows} />;
}
