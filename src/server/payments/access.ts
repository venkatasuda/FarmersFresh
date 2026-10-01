import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/server/supabase/server";

export function equalSignature(expected: string, actual: unknown): boolean {
  return typeof actual === "string" && /^[a-f0-9]{64}$/.test(actual) &&
    timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

function signature(id: string, expires: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Payment access is not configured.");
  return createHmac("sha256", secret).update(`guest-payment:${id}:${expires}`).digest("hex");
}

export async function grantGuestPayment(id: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  (await cookies()).set(`ff-pay-${id}`, `${expires}.${signature(id, expires)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/razorpay", maxAge: 3600,
  });
}

export async function canPay(id: string, userId: string | null, allowGuest = false) {
  if (userId) {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    return !error && user?.id === userId;
  }
  if (!allowGuest) return false;
  const token = (await cookies()).get(`ff-pay-${id}`)?.value;
  if (!token) return false;
  const [expires, mac, extra] = token.split(".");
  return !extra && /^\d{10}$/.test(expires) && Number(expires) > Date.now() / 1000 && equalSignature(signature(id, expires), mac);
}
