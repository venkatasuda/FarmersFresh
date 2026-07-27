import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCatalogue } from "@/lib/shop";
import { getBatches, getFarms } from "./actions";
import { TraceabilityClient } from "./traceability-client";

export const metadata = { title: "Traceability · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function TraceabilityPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const [farms, batches, catalogue] = await Promise.all([
    getFarms(),
    getBatches(),
    getCatalogue(),
  ]);
  const products = catalogue.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Traceability</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Food-safety lot tracking — source farms, stock batches, and a recall
          lookup. Internal only; customers never see farm names.
        </p>
      </div>
      <TraceabilityClient farms={farms} batches={batches} products={products} />
    </div>
  );
}
