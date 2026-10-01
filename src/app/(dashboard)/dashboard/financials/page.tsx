import { getFinancials } from "@/server/reporting/staff-financials";
import { FinancialsClient } from "@/features/dashboard/financials/financials-client";
import { requireSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Financials · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function FinancialsPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const initial = await getFinancials(30);

  return <FinancialsClient initial={initial} initialDays={30} />;
}
