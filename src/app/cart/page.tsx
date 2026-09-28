import { ShopShell } from "@/app/(shop)/shop-shell";
import { CartClient } from "./cart-client";

export const metadata = { title: "Basket · Farmers Fresh" };

export default function CartPage() {
  return (
    <ShopShell>
      <CartClient />
    </ShopShell>
  );
}
