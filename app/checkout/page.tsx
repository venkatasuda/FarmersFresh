import { ShopShell } from "@/app/(shop)/shop-shell";
import { CheckoutClient } from "./checkout-client";

export const metadata = { title: "Checkout · Farmers Fresh" };

export default function CheckoutPage() {
  return (
    <ShopShell>
      <CheckoutClient />
    </ShopShell>
  );
}
