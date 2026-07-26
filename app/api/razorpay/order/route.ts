import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Starts a Razorpay payment for an EXISTING held order.
 *
 * The browser sends only the order id — never an amount. The amount is read
 * from the order row server-side (service role), so a tampered client can't ask
 * to pay ₹1 for a ₹2000 basket. The Razorpay order id is stored back on the row
 * so the verify step can confirm the payment belongs to this order.
 *
 * Dependency-free: talks to Razorpay's REST API with Basic auth. No-ops with a
 * clear error until keys are set, so a COD-only launch never breaks. Set
 * RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY, and the
 * public NEXT_PUBLIC_RAZORPAY_KEY_ID. See docs/PAYMENTS.md.
 */
export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!keyId || !keySecret || !serviceRole || !supabaseUrl) {
    return NextResponse.json(
      { error: "Online payment isn't set up yet." },
      { status: 503 }
    );
  }

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const orderId = body.orderId;
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Missing order." }, { status: 400 });
  }

  // Authoritative amount: read the order the server created, not the client.
  const admin = createClient(supabaseUrl, serviceRole);
  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, total, is_paid, status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.is_paid) {
    return NextResponse.json({ error: "Order is already paid." }, { status: 409 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "This order isn't awaiting payment." },
      { status: 409 }
    );
  }

  const rupees = Number(order.total);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(rupees * 100), // paise
      currency: "INR",
      receipt: order.order_number,
      notes: { orderId: order.id },
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Couldn't start payment." }, { status: 502 });
  }

  const rp = (await res.json()) as { id: string; amount: number };

  // Remember which Razorpay order pays for this order, so verify can cross-check.
  await admin
    .from("orders")
    .update({ razorpay_order_id: rp.id })
    .eq("id", order.id);

  return NextResponse.json({
    razorpayOrderId: rp.id,
    amount: rp.amount,
    keyId,
    orderNumber: order.order_number,
  });
}
