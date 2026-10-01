import { ProductionClient } from "@/features/dashboard/production/production-client";
import { requireSession } from "@/server/auth/session";
import { getReorderSuggestions } from "@/server/procurement/forecast";
import { redirect } from "next/navigation";

export const metadata = { title: "Production · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  // Plan one day of cover on top of what's on hand — the "cut sheet".
  const plan = await getReorderSuggestions({ lookback: 28, horizon: 1, lead: 0 });
  return <ProductionClient initial={plan.suggestions} />;
}
