import { ShopShell } from "@/features/shop/shop-shell";
import { WishlistClient } from "@/features/wishlist/wishlist-client";

export const metadata = { title: "Favourites · Farmers Fresh" };

export default function WishlistPage() {
  return (
    <ShopShell>
      <WishlistClient />
    </ShopShell>
  );
}
