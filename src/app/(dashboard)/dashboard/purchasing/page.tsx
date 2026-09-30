import { getOverview, getPurchaseOrders, getSuppliers, } from "@/server/procurement/staff-purchasing";
import { PurchasingClient } from "@/features/dashboard/purchasing/purchasing-client";
import { requireSession } from "@/server/auth/session";
import { getStockLines, getStorefrontLocationId } from "@/server/inventory/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "Purchasing · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const session = await requireSession();
  // Procurement is cost-sensitive — keep it to owners.
  if (!session.isOwner) redirect("/dashboard");

  const [suppliers, orders, overview, stockLines, locationId] =
    await Promise.all([
      getSuppliers(true),
      getPurchaseOrders(),
      getOverview(),
      getStockLines(),
      getStorefrontLocationId(),
    ]);

  const products = stockLines.map((l) => ({
    id: l.productId,
    name: l.name,
    unit: l.unit,
  }));

  return (
    <PurchasingClient
      initialSuppliers={suppliers}
      initialOrders={orders}
      overview={overview}
      products={products}
      locationId={locationId}
    />
  );
}
