import { CartClient } from "@/features/cart/cart-client";

export const metadata = { title: "Basket · Farmers Fresh" };

export default function CartPage() {
  return (
    <>
      <CartClient />
    </>
  );
}
