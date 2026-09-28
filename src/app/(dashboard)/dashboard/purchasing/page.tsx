import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getStockLines, getStorefrontLocationId } from "@/server/stock";
import {
  getOverview,
  getPurchaseOrders,
  getSuppliers,
} from "@/features/dashboard/purchasing/actions";
import { PurchasingClient } from "@/features/dashboard/purchasing/purchasing-client";

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
