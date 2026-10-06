import { getOverview, getPurchaseOrders, getSuppliers, } from "@/server/procurement/staff-purchasing";
import { PurchasingClient } from "@/features/dashboard/purchasing/purchasing-client";
import { requireSession } from "@/server/auth/session";
import { getStockLines } from "@/server/inventory/queries";
import { getOperationalLocations } from "@/server/auth/permissions";
import { StoreSelector } from "@/features/dashboard/navigation/store-selector";
import { redirect } from "next/navigation";

export const metadata = { title: "Purchasing · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  await requireSession();
  const locations = await getOperationalLocations("procurement.manage");
  if (!locations.length) redirect("/dashboard");
  const requested = (await searchParams).location;
  const locationId = locations.find(l => l.id === requested)?.id ?? locations[0].id;

  const [suppliers, orders, overview, stockLines] =
    await Promise.all([
      getSuppliers(true),
      getPurchaseOrders(locationId),
      getOverview(locationId),
      getStockLines(locationId),
    ]);

  const products = stockLines.map((l) => ({
    id: l.productId,
    name: l.name,
    unit: l.unit,
  }));

  return (
    <><StoreSelector locations={locations} locationId={locationId} />
    <PurchasingClient
      key={locationId}
      initialSuppliers={suppliers}
      initialOrders={orders}
      overview={overview}
      products={products}
      locationId={locationId}
    /></>
  );
}
