import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Starts a Razorpay payment for a pending Farmers Fresh Pass. Like the order
 * route, the amount is read server-side from the membership row (never the
 * client), and the Razorpay order id is stored back for the verify cross-check.
 * No-ops with a clear error until keys are set.
 */
export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!keyId || !keySecret || !serviceRole || !supabaseUrl) {
    return NextResponse.json({ error: "Online payment isn't set up yet." }, { status: 503 });
  }

  let body: { membershipId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = body.membershipId;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing membership." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { data: m, error } = await admin
    .from("pass_memberships")
    .select("id, amount, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !m) return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  if (m.status !== "pending_payment") {
    return NextResponse.json({ error: "This pass isn't awaiting payment." }, { status: 409 });
  }

  const rupees = Number(m.amount);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
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
  await admin.from("pass_memberships").update({ razorpay_order_id: rp.id }).eq("id", id);

  return NextResponse.json({ razorpayOrderId: rp.id, amount: rp.amount, keyId });
}
