import { CartProvider } from "@/features/cart/cart-context";
import { CartDrawer } from "@/features/cart/cart-drawer";
import { CartToast } from "@/features/cart/cart-toast";
import { WishlistProvider } from "@/features/wishlist/wishlist-context";
import { getStoreSettings } from "@/server/settings/queries";
import { ShopShell } from "./shop-shell";
import { ServiceWorkerRegister } from "./sw-register";

export async function StorefrontShell({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings();
  return (
    <WishlistProvider>
      <CartProvider freeDeliveryThreshold={settings.freeDeliveryThreshold}>
        <ShopShell>{children}</ShopShell>
        <CartDrawer />
        <CartToast />
      </CartProvider>
      <ServiceWorkerRegister />
    </WishlistProvider>
  );
}
