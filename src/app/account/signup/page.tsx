import { ShopShell } from "@/features/shop/shop-shell";
import { SignupClient } from "@/features/auth/signup-client";

export const metadata = { title: "Create account · Farmers Fresh" };

export default function SignupPage() {
  return (
    <ShopShell>
      <SignupClient />
    </ShopShell>
  );
}
