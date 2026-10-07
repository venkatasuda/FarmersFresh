import { StockPageView } from "@/features/dashboard/stock/stock-view";
import { LOW_STOCK_KG } from "@/lib/types";
import { requireSession } from "@/server/auth/session";
import { getRecentMovements, getStockLines } from "@/server/inventory/queries";
import { getOperationalLocations } from "@/server/auth/permissions";
import { getTransfers } from "@/server/inventory/staff-stock";
import { StoreSelector } from "@/features/dashboard/navigation/store-selector";
import { redirect } from "next/navigation";

export const metadata = { title: "Stock · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  await requireSession();
  const locations = await getOperationalLocations("inventory.adjust");
  if (!locations.length) redirect("/dashboard");
  const requested = (await searchParams).location;
  const locationId = locations.find(l => l.id === requested)?.id ?? locations[0].id;

  const [lines, movements, transferData] = await Promise.all([
    getStockLines(locationId),
    getRecentMovements(20, locationId),
    getTransfers(locationId),
  ]);

  const out = lines.filter((l) => l.onHand <= 0);
  const low = lines.filter((l) => l.onHand > 0 && l.onHand < LOW_STOCK_KG);

  return <><StoreSelector locations={locations} locationId={locationId} /><StockPageView key={locationId} out={out} low={low} locationId={locationId} lines={lines} movements={movements} {...transferData} /></>;
}
