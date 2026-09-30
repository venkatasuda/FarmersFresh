import { StockPageView } from "@/features/dashboard/stock/stock-view";
import { LOW_STOCK_KG } from "@/lib/types";
import { requireSession } from "@/server/auth/session";
import { getRecentMovements, getStockLines, getStorefrontLocationId, } from "@/server/inventory/queries";

export const metadata = { title: "Stock · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireSession();

  const [lines, movements, locationId] = await Promise.all([
    getStockLines(),
    getRecentMovements(20),
    getStorefrontLocationId(),
  ]);

  const out = lines.filter((l) => l.onHand <= 0);
  const low = lines.filter((l) => l.onHand > 0 && l.onHand < LOW_STOCK_KG);

  return <StockPageView out={out} low={low} locationId={locationId} lines={lines} movements={movements} />;
}
