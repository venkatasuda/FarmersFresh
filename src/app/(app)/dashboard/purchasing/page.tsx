import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getStockLines, getStorefrontLocationId } from "@/lib/stock";
import {
  getOverview,
  getPurchaseOrders,
  getSuppliers,
} from "./actions";
import { PurchasingClient } from "./purchasing-client";

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
