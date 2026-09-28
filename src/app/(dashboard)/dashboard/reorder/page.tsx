import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getReorderSuggestions } from "@/server/forecast";
import { getSuppliers } from "@/features/dashboard/purchasing/actions";
import { ReorderClient } from "@/features/dashboard/reorder/reorder-client";

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
