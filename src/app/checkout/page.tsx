import { ShopShell } from "@/app/(shop)/shop-shell";
import { getStoreSettings } from "@/lib/settings";
import { getMyMembership } from "@/app/pass/actions";
import { CheckoutClient } from "./checkout-client";

export const metadata = { title: "Checkout · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [settings, membership] = await Promise.all([
    getStoreSettings(),
    getMyMembership(),
  ]);
  return (
    <ShopShell>
      <CheckoutClient
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
        deliveryFee={settings.deliveryFee}
        memberDiscountPct={membership?.discountPercent ?? 0}
      />
    </ShopShell>
  );
}
