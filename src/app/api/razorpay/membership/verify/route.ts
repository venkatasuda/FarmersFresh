import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies a Razorpay payment for a Pass and activates the membership. The
 * signature is checked server-side and cross-checked against the Razorpay order
 * stored on the membership, then activate_membership (service-role only) sets it
 * live. Mirrors the order verify route.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !serviceRole || !supabaseUrl) {
    return NextResponse.json({ error: "Online payment isn't set up yet." }, { status: 503 });
  }

  let body: {
    membershipId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { membershipId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!membershipId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Signature mismatch." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { data: m } = await admin
    .from("pass_memberships")
    .select("razorpay_order_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!m || m.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match membership." }, { status: 400 });
  }

  const { error } = await admin.rpc("activate_membership", {
    p_id: membershipId,
    p_rp_order: razorpay_order_id,
    p_rp_payment: razorpay_payment_id,
  });
  if (error) return NextResponse.json({ error: "Couldn't activate." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
