import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies a Razorpay payment signature and marks the order paid. The signature
 * check happens HERE, server-side, before anything is trusted — a client can't
 * fake a payment. Uses the service-role key to call mark_order_paid (which is
 * revoked from all client roles).
 *
 * Needs RAZORPAY_KEY_SECRET and SUPABASE_SERVICE_ROLE_KEY. See docs/PAYMENTS.md.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !serviceRole || !supabaseUrl) {
    return NextResponse.json(
      { error: "Online payment isn't set up yet." },
      { status: 503 }
    );
  }

  let body: {
    orderId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    body;
  if (
    !orderId ||
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Razorpay signs `order_id|payment_id` with the key secret.
  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Signature mismatch." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { error } = await admin.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_razorpay_order: razorpay_order_id,
    p_razorpay_payment: razorpay_payment_id,
  });

  if (error) {
    return NextResponse.json({ error: "Couldn't record payment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
