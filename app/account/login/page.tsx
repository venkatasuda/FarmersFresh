import { ShopShell } from "@/app/(shop)/shop-shell";
import { LoginClient } from "./login-client";

export const metadata = { title: "Log in · Farmers Fresh" };

export default function AccountLoginPage() {
  return (
    <ShopShell>
      <LoginClient />
    </ShopShell>
  );
}
