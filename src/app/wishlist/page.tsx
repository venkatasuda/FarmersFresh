import { ShopShell } from "@/app/(shop)/shop-shell";
import { WishlistClient } from "./wishlist-client";

export const metadata = { title: "Favourites · Farmers Fresh" };

export default function WishlistPage() {
  return (
    <ShopShell>
      <WishlistClient />
    </ShopShell>
  );
}
