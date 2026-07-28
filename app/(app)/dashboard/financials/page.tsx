import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getFinancials } from "./actions";
import { FinancialsClient } from "./financials-client";

export const metadata = { title: "Financials · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function FinancialsPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const initial = await getFinancials(30);

  return <FinancialsClient initial={initial} initialDays={30} />;
}
