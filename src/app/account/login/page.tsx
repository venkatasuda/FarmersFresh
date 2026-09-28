import { Suspense } from "react";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { LoginClient } from "./login-client";

export const metadata = { title: "Log in · Farmers Fresh" };

export default function AccountLoginPage() {
  return (
    <ShopShell>
      <Suspense fallback={<div className="mx-auto h-96 max-w-sm" />}>
        <LoginClient />
      </Suspense>
    </ShopShell>
  );
}
