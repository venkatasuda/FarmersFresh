import { ShopShell } from "@/app/(shop)/shop-shell";
import { SignupClient } from "./signup-client";

export const metadata = { title: "Create account · Farmers Fresh" };

export default function SignupPage() {
  return (
    <ShopShell>
      <SignupClient />
    </ShopShell>
  );
}
