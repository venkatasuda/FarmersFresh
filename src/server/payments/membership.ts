import "server-only";
import { canPay } from "./access";
import { readObject } from "@/server/security/http";
import { isUuid } from "@/lib/guard";
import { createAdminClient } from "@/server/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
/**
 * Starts a Razorpay payment for a pending Farmers Fresh Pass. Like the order
 * route, the amount is read server-side from the membership row (never the
 * client), and the Razorpay order id is stored back for the verify cross-check.
 * No-ops with a clear error until keys are set.
 */
export async function createMembershipPayment(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!keyId || !keySecret || !serviceRole || !supabaseUrl) {
    return NextResponse.json({ error: "Online payment isn't set up yet." }, { status: 503 });
  }

  const body = await readObject(request);

  const id = body.membershipId;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Missing membership." }, { status: 400 });
  }

  const admin = createAdminClient(supabaseUrl, serviceRole);
  const { data: m, error } = await admin
    .from("pass_memberships")
    .select("id, user_id, amount, status, razorpay_order_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !m) return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  if (!await canPay(id, m.user_id, false)) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }
  if (m.status !== "pending_payment") {
    return NextResponse.json({ error: "This pass isn't awaiting payment." }, { status: 409 });
  }

  const rupees = Number(m.amount);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  // Idempotent: reuse an existing Razorpay order for this pass, don't make a 2nd.
  if (m.razorpay_order_id) {
    return NextResponse.json({
      razorpayOrderId: m.razorpay_order_id,
      amount: Math.round(rupees * 100),
      keyId,
    });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(rupees * 100),
      currency: "INR",
      receipt: `pass_${id}`,
      notes: { membershipId: id },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "Couldn't start payment." }, { status: 502 });

  const rp = (await res.json()) as { id: string; amount: number };
  if (typeof rp?.id !== "string" || !/^order_[A-Za-z0-9]+$/.test(rp.id) || rp.amount !== Math.round(rupees * 100)) {
    return NextResponse.json({ error: "Invalid payment provider response." }, { status: 502 });
  }

  // Race-safe + checked save (see the order route for the rationale).
  const { data: saved, error: saveErr } = await admin
    .from("pass_memberships")
    .update({ razorpay_order_id: rp.id })
    .eq("id", id)
    .is("razorpay_order_id", null)
    .select("razorpay_order_id");

  if (saveErr) {
    return NextResponse.json({ error: "Couldn't record the payment order." }, { status: 500 });
  }
  if (!saved || saved.length === 0) {
    const { data: fresh } = await admin
      .from("pass_memberships")
      .select("razorpay_order_id")
      .eq("id", id)
      .maybeSingle();
    if (fresh?.razorpay_order_id) {
      return NextResponse.json({
        razorpayOrderId: fresh.razorpay_order_id,
        amount: Math.round(rupees * 100),
        keyId,
      });
    }
    return NextResponse.json({ error: "Couldn't record the payment order." }, { status: 500 });
  }

  return NextResponse.json({ razorpayOrderId: rp.id, amount: rp.amount, keyId });
}
