/**
 * Client-side Razorpay checkout, kept out of the component for readability.
 *
 * The order is already created and held on the server before this runs. Here we
 * (1) ask the server to open a Razorpay order for that order's authoritative
 * amount, (2) let the customer pay via Razorpay's own secure sheet (UPI, cards,
 * wallets — we never touch card numbers), and (3) hand the result back to the
 * server to verify the signature and mark the order paid. Nothing here is
 * trusted: the server re-checks everything.
 */

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean };
  theme?: { color?: string };
  handler: (r: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayCtor = new (options: RazorpayOptions) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const el = document.createElement("script");
    el.src = SCRIPT;
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.body.appendChild(el);
  });
}

export type PayResult =
  | { status: "paid" }
  | { status: "dismissed" }
  | { status: "error"; message: string };

export async function payForOrder(params: {
  orderId: string;
  method: "upi" | "card";
  prefill: { name: string; email: string; phone: string };
}): Promise<PayResult> {
  const ok = await loadScript();
  if (!ok || !window.Razorpay) {
    return { status: "error", message: "Couldn't load the payment window. Check your connection." };
  }

  // Ask the server to open a Razorpay order for this held order.
  let opened: { razorpayOrderId: string; amount: number; keyId: string };
  try {
    const res = await fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: params.orderId }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return { status: "error", message: j.error ?? "Couldn't start the payment." };
    }
    opened = (await res.json()) as typeof opened;
  } catch {
    return { status: "error", message: "Couldn't reach the payment service." };
  }

  return new Promise<PayResult>((resolve) => {
    const rzp = new window.Razorpay!({
      key: opened.keyId,
      order_id: opened.razorpayOrderId,
      amount: opened.amount,
      currency: "INR",
      name: "Farmers Fresh",
      description: "Order payment",
      prefill: {
        name: params.prefill.name,
        email: params.prefill.email,
        contact: params.prefill.phone,
      },
      // Open on the tab the customer chose; they can still switch inside.
      method:
        params.method === "upi"
          ? { upi: true, card: true, netbanking: true, wallet: true }
          : { card: true, upi: true, netbanking: true, wallet: true },
      theme: { color: "#16733e" },
      handler: async (r) => {
        try {
          const res = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: params.orderId,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            }),
          });
          if (res.ok) resolve({ status: "paid" });
          else {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            resolve({ status: "error", message: j.error ?? "We couldn't confirm the payment." });
          }
        } catch {
          resolve({ status: "error", message: "We couldn't confirm the payment." });
        }
      },
      modal: { ondismiss: () => resolve({ status: "dismissed" }) },
    });
    rzp.open();
  });
}
