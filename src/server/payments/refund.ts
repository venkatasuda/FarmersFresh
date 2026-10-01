import "server-only";
import { isUuid } from "@/lib/guard";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";

export async function refundOrder(orderId: string): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(orderId)) return { ok: false, message: "Invalid order." };
  const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !secret || !url || !service) return { ok: false, message: "Online refunds are not configured yet." };
  try {
    const client = await createClient();
    const { data: refund, error } = await client.rpc("request_order_refund", { p_order_id: orderId });
    if (error || !refund) return { ok: false, message: "You cannot refund this order." };
    if (refund.status === "processed") return { ok: true, message: "Refund processed." };
    if (refund.status === "failed") return { ok: false, message: "Refund failed. Review it with Razorpay before retrying." };
    if (!/^[0-9a-f-]{36}$/i.test(refund.id) || !/^pay_[A-Za-z0-9]+$/.test(refund.payment_id) ||
      !Number.isSafeInteger(refund.amount) || refund.amount < 100 ||
      (refund.provider_id && !/^rfnd_[A-Za-z0-9]+$/.test(refund.provider_id))) throw new Error();
    const response = await fetch(refund.provider_id
      ? `https://api.razorpay.com/v1/refunds/${refund.provider_id}`
      : `https://api.razorpay.com/v1/payments/${refund.payment_id}/refund`, {
      method: refund.provider_id ? "GET" : "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json", "X-Refund-Idempotency": refund.id },
      ...(refund.provider_id ? {} : { body: JSON.stringify({ amount: refund.amount }) }),
      signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!/^rfnd_[A-Za-z0-9]+$/.test(result.id ?? "") || result.payment_id !== refund.payment_id ||
      result.amount !== refund.amount || result.currency !== "INR" || !["pending", "processed", "failed"].includes(result.status) ||
      (refund.provider_id && result.id !== refund.provider_id)) throw new Error();
    const { data: status, error: saveError } = await createAdminClient(url, service).rpc("record_order_refund", {
      p_refund_id: result.id, p_payment_id: result.payment_id, p_amount: result.amount, p_status: result.status,
    });
    if (saveError || !["pending", "processed", "failed"].includes(status)) throw new Error();
    return { ok: status !== "failed", message: status === "processed" ? "Refund processed." :
      status === "pending" ? "Refund submitted. Check again later for confirmation." : "Refund failed. Review it with Razorpay." };
  } catch { return { ok: false, message: "Refund could not be confirmed. Retry safely to check its status." }; }
}
