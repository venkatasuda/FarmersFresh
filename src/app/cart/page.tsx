import { ShopShell } from "@/features/shop/shop-shell";
import { CartClient } from "@/features/cart/cart-client";

export const metadata = { title: "Basket · Farmers Fresh" };

export default function CartPage() {
  return (
    <ShopShell>
      <CartClient />
    </ShopShell>
  );
}
