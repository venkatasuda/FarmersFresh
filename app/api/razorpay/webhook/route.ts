import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Razorpay webhook — the AUTHORITATIVE payment reconciliation path. The browser
 * /verify call is best-effort UX; this fires server-to-server even if the
 * customer closes the tab, so a successful payment always settles the order (or
 * membership). Idempotent: settle_razorpay_payment() dedupes on the payment id.
 *
 * Set the webhook in the Razorpay dashboard to POST /api/razorpay/webhook for
 * the `payment.captured` event, with secret RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceRole || !supabaseUrl) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Signature is over the RAW body, so read text before parsing.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let body: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  // Only captured payments move money. Anything else: acknowledge and ignore.
  if (body.event !== "payment.captured") {
    return NextResponse.json({ ok: true, ignored: body.event ?? null });
  }

  const p = body.payload?.payment?.entity;
  if (!p?.id || !p.order_id) {
    return NextResponse.json({ ok: true, ignored: "no_payment_entity" });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { data, error } = await admin.rpc("settle_razorpay_payment", {
    p_payment_id: p.id,
    p_rp_order: p.order_id,
    p_amount: p.amount ?? null,
    p_event: body.event,
    p_raw: body,
  });

  if (error) {
    // 500 so Razorpay retries (the settle is idempotent, so a retry is safe).
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: data });
}
