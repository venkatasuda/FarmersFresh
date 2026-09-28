import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getReorderSuggestions } from "@/lib/forecast";
import { getSuppliers } from "../purchasing/actions";
import { ReorderClient } from "./reorder-client";

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
