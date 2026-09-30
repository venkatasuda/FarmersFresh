import { getSuppliers } from "@/server/procurement/staff-purchasing";
import { ReorderClient } from "@/features/dashboard/reorder/reorder-client";
import { requireSession } from "@/server/auth/session";
import { getReorderSuggestions } from "@/server/procurement/forecast";
import { redirect } from "next/navigation";

export const metadata = { title: "Reorder · Farmers Fresh" };
export const dynamic = "force-dynamic";

const DEFAULTS = { lookback: 28, horizon: 7, lead: 2 };

export default async function ReorderPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const [forecast, suppliers] = await Promise.all([
    getReorderSuggestions(DEFAULTS),
    getSuppliers(),
  ]);

  return (
    <ReorderClient
      initial={forecast}
      defaults={DEFAULTS}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
