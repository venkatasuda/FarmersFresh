import "server-only";

export async function capturedPayment(paymentId: string, orderId: string, rupees: number): Promise<{ amount: number } | null> {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("Payment provider unavailable.");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!response.ok) throw new Error("Payment provider unavailable.");
  const payment = await response.json();
  if (!payment || payment.id !== paymentId || payment.order_id !== orderId || payment.status !== "captured" ||
      payment.currency !== "INR" || !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.amount !== Math.round(rupees * 100)) return null;
  return { amount: payment.amount };
}
