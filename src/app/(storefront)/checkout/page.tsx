import { CheckoutClient } from "@/features/checkout/checkout-client";
import { getMyMembership } from "@/server/subscriptions/pass";
import { getStoreSettings } from "@/server/settings/queries";

export const metadata = { title: "Checkout · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [settings, membership] = await Promise.all([
    getStoreSettings(),
    getMyMembership(),
  ]);
  return (
    <>
      <CheckoutClient
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
        deliveryFee={settings.deliveryFee}
        memberDiscountPct={membership?.discountPercent ?? 0}
      />
    </>
  );
}
