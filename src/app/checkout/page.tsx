import { ShopShell } from "@/features/shop/shop-shell";
import { getStoreSettings } from "@/server/settings";
import { getMyMembership } from "@/features/pass/actions";
import { CheckoutClient } from "@/features/checkout/checkout-client";

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
