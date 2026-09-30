import "server-only";
import { canPay, equalSignature } from "./access";
import { readObject } from "@/server/security/http";
import { isUuid } from "@/lib/guard";
import { capturedPayment } from "./captured";
import { createAdminClient } from "@/server/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
/**
 * Verifies a Razorpay payment signature and marks the order paid. The signature
 * check happens HERE, server-side, before anything is trusted — a client can't
 * fake a payment. Uses the service-role key to call mark_order_paid (which is
 * revoked from all client roles).
 *
 * Needs RAZORPAY_KEY_SECRET and SUPABASE_SERVICE_ROLE_KEY. See docs/operations/payments.md.
 */
export async function verifyOrderPayment(request: NextRequest) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !serviceRole || !supabaseUrl) {
    return NextResponse.json(
      { error: "Online payment isn't set up yet." },
      { status: 503 }
    );
  }

  const body = await readObject(request);

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    body;
  if (!isUuid(orderId) || typeof razorpay_order_id !== "string" || !/^order_[A-Za-z0-9]+$/.test(razorpay_order_id) || typeof razorpay_payment_id !== "string" || !/^pay_[A-Za-z0-9]+$/.test(razorpay_payment_id) || typeof razorpay_signature !== "string") {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Razorpay signs `order_id|payment_id` with the key secret.
  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (!equalSignature(expected, razorpay_signature)) {
    return NextResponse.json({ error: "Signature mismatch." }, { status: 400 });
  }

  const admin = createAdminClient(supabaseUrl, serviceRole);

  // Cross-check: this payment must be for the Razorpay order we opened against
  // THIS shop order. Without this, a valid signature from any cheap Razorpay
  // order could be replayed to settle an expensive one.
  const { data: order } = await admin
    .from("orders")
    .select("razorpay_order_id, user_id, total")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match order." }, { status: 400 });
  }

  if (!await canPay(orderId, order.user_id, true)) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const payment = await capturedPayment(razorpay_payment_id, razorpay_order_id, Number(order.total));
  if (!payment) return NextResponse.json({ error: "Payment is not captured yet. Please retry." }, { status: 409 });
  const { data: settled, error } = await admin.rpc("settle_razorpay_payment", {
    p_payment_id: razorpay_payment_id, p_rp_order: razorpay_order_id, p_amount: payment.amount,
    p_event: "payment.captured", p_raw: { source: "verified_callback" },
  });
  if (!error && !["order_paid", "membership_activated", "duplicate"].includes(String(settled))) {
    return NextResponse.json({ error: "Payment needs reconciliation." }, { status: 409 });
  }

  if (error) {
    return NextResponse.json({ error: "Couldn't record payment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
