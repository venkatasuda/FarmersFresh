import { getWastageList, getWastageSummary } from "@/server/inventory/staff-wastage";
import { WastageClient } from "@/features/dashboard/wastage/wastage-client";
import { requireSession } from "@/server/auth/session";
import { getStockLines } from "@/server/inventory/queries";
import { getOperationalLocations } from "@/server/auth/permissions";
import { StoreSelector } from "@/features/dashboard/navigation/store-selector";
import { redirect } from "next/navigation";

export const metadata = { title: "Wastage · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function WastagePage({ searchParams }: { searchParams: Promise<{location?:string}> }) {
  await requireSession();
  const locations=await getOperationalLocations("inventory.adjust");
  if (!locations.length) redirect("/dashboard");
  const requested=(await searchParams).location;
  const locationId=locations.find(l=>l.id===requested)?.id ?? locations[0].id;

  const [summary, list, stockLines] = await Promise.all([
    getWastageSummary(30, locationId),
    getWastageList(30, locationId),
    getStockLines(locationId),
  ]);

  const products = stockLines.map((l) => ({
    id: l.productId,
    name: l.name,
    unit: l.unit,
    onHand: l.onHand,
  }));

  return (
    <><StoreSelector locations={locations} locationId={locationId} /><WastageClient key={locationId}
      summary={summary}
      list={list}
      products={products}
      locationId={locationId}
    /></>
  );
}
