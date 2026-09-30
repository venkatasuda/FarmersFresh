import { LoginClient } from "@/features/auth/login-client";
import { Suspense } from "react";

export const metadata = { title: "Log in · Farmers Fresh" };

export default function AccountLoginPage() {
  return (
    <>
      <Suspense fallback={<div className="mx-auto h-96 max-w-sm" />}>
        <LoginClient />
      </Suspense>
    </>
  );
}
