import { NextResponse, type NextRequest } from "next/server";

/**
 * Creates a Razorpay order for an amount, returning the id the client SDK needs
 * to open checkout. Dependency-free — calls Razorpay's REST API with Basic auth
 * (no SDK to install). No-ops with a clear error until keys are set, so it
 * never breaks the build or a COD-only launch.
 *
 * Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment. The public
 * key id also goes in NEXT_PUBLIC_RAZORPAY_KEY_ID for the client. See
 * docs/PAYMENTS.md.
 */
export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Online payment isn't set up yet." },
      { status: 503 }
    );
  }

  let body: { amount?: number; orderNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const rupees = Number(body.amount);
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
      receipt: body.orderNumber ?? undefined,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Couldn't start payment." },
      { status: 502 }
    );
  }

  const order = (await res.json()) as { id: string; amount: number };
  return NextResponse.json({
    razorpayOrderId: order.id,
    amount: order.amount,
    keyId,
  });
}
