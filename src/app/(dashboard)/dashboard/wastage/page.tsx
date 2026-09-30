import { getWastageList, getWastageSummary } from "@/server/inventory/staff-wastage";
import { WastageClient } from "@/features/dashboard/wastage/wastage-client";
import { requireSession } from "@/server/auth/session";
import { getStockLines, getStorefrontLocationId } from "@/server/inventory/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "Wastage · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function WastagePage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const [summary, list, stockLines, locationId] = await Promise.all([
    getWastageSummary(30),
    getWastageList(30),
    getStockLines(),
    getStorefrontLocationId(),
  ]);

  const products = stockLines.map((l) => ({
    id: l.productId,
    name: l.name,
    unit: l.unit,
    onHand: l.onHand,
  }));

  return (
    <WastageClient
      summary={summary}
      list={list}
      products={products}
      locationId={locationId}
    />
  );
}
