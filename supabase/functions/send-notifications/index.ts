// Notification worker — drains the `notifications` outbox and delivers each
// pending row on its channel. Poller, run on a schedule (see the DB cron).
// Idempotent: only touches rows still 'pending', marks each as it goes.
//
// verify_jwt is FALSE because the platform scheduler calls it, not a user. It
// authenticates with the service-role key from the env and takes no request
// input, so there is no user-facing attack surface.
//
// Channels light up as provider keys are added:
//   email    -> RESEND_API_KEY
//   sms      -> MSG91_AUTHKEY + MSG91_SENDER
//   whatsapp -> WHATSAPP_TOKEN + WHATSAPP_PHONE_ID  (Meta Cloud API)
// A channel with no key is marked 'skipped', not 'failed'.
//
// The customer 'order.placed' EMAIL is a full itemised HTML receipt (fetched
// with the service-role client). SMS/WhatsApp stay short — a receipt doesn't
// belong in a text message; those carry the confirmation + a track link.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "orders@farmersfresh.store";
const SITE_URL = (Deno.env.get("NOTIFY_SITE_URL") ?? "https://farmersfresh.store").replace(/\/$/, "");
const MSG91_AUTHKEY = Deno.env.get("MSG91_AUTHKEY");
const MSG91_SENDER = Deno.env.get("MSG91_SENDER");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? `mailto:${FROM_EMAIL}`;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (_e) {
    // Bad keys — push stays skipped rather than crashing the worker.
  }
}

type Notif = {
  id: number;
  channel: "email" | "sms" | "whatsapp" | "push";
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function rupees(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `Rs.${n.toFixed(0)}` : String(v ?? "");
}
function money(v: unknown): string {
  const n = Number(v);
  return `₹${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  upi: "UPI",
  card: "Card",
  upi_on_delivery: "UPI on delivery",
};

// ---- message bodies, per template ---------------------------------------
function staffLines(p: Record<string, unknown>): string[] {
  return [
    `New order ${p.order_number} - ${rupees(p.total)}`,
    `${p.name ?? ""} - ${p.phone ?? ""}`,
    `${p.address ?? ""}${p.pincode ? " - " + p.pincode : ""}`,
    p.items ? `Items: ${p.items}` : "",
    p.slot ? `Slot: ${p.slot}` : "",
  ].filter(Boolean) as string[];
}

function customerBody(template: string, p: Record<string, unknown>): string {
  const num = p.order_number;
  switch (template) {
    case "order.placed.customer":
      return `Hi ${p.name ?? ""}, thanks for your order ${num} with Farmers Fresh. Total ${rupees(p.total)}. Your receipt is below. Track: ${SITE_URL}/track`;
    case "order.confirmed.customer":
      return `Your Farmers Fresh order ${num} is confirmed and being prepared. We'll let you know when it's on the way.`;
    case "order.out_for_delivery.customer":
      return `Good news! Your Farmers Fresh order ${num} is out for delivery. Please keep ${rupees(p.total)} ready (cash or UPI).`;
    case "order.delivered.customer":
      return `Your Farmers Fresh order ${num} has been delivered. Thank you — we hope you enjoy it! Order again at ${SITE_URL}`;
    case "order.cancelled.customer":
      return `Your Farmers Fresh order ${num} has been cancelled. If this is unexpected, please call us.`;
    case "stock.back.customer":
      return `Good news! ${p.product_name ?? "An item you wanted"} is back in stock at Farmers Fresh. Order now: ${SITE_URL}${p.slug ? "/shop/" + p.slug : ""}`;
    default:
      return `Update on your Farmers Fresh order ${num}.`;
  }
}

function subjectFor(template: string, p: Record<string, unknown>): string {
  if (template === "order.placed.customer")
    return `Your Farmers Fresh receipt — order ${p.order_number}`;
  if (template === "stock.back.customer")
    return `${p.product_name ?? "An item you wanted"} is back in stock`;
  if (template.startsWith("order.placed"))
    return `New order ${p.order_number} - ${rupees(p.total)}`;
  return `Farmers Fresh order ${p.order_number}`;
}

// Where a push notification should take the customer when tapped.
function targetUrl(p: Record<string, unknown>): string {
  if (p.slug) return `${SITE_URL}/shop/${p.slug}`;
  if (p.order_number) return `${SITE_URL}/track`;
  return SITE_URL;
}

function bodyFor(n: Notif): string {
  if (n.template.endsWith(".customer")) return customerBody(n.template, n.payload);
  return staffLines(n.payload).join("\n");
}

// ---- receipt (email only) ----------------------------------------------
type OrderRow = Record<string, unknown>;
type ItemRow = { product_name: string; quantity: number; unit: string; unit_price: number; line_total: number };

async function fetchReceipt(orderNumber: unknown): Promise<{ o: OrderRow; items: ItemRow[] } | null> {
  if (!orderNumber) return null;
  const { data: o } = await admin
    .from("orders")
    .select("id, order_number, placed_at, status, is_paid, payment_method, contact_name, contact_phone, address_line, city, pincode, subtotal, discount, coupon_code, credit_used, delivery_fee, total")
    .eq("order_number", String(orderNumber))
    .maybeSingle();
  if (!o) return null;
  const { data: items } = await admin
    .from("order_items")
    .select("product_name, quantity, unit, unit_price, line_total")
    .eq("order_id", (o as OrderRow).id as string)
    .order("product_name");
  return { o: o as OrderRow, items: (items ?? []) as ItemRow[] };
}

function receiptHtml(o: OrderRow, items: ItemRow[]): string {
  const online = o.payment_method === "upi" || o.payment_method === "card";
  const payLabel = PAYMENT_LABELS[String(o.payment_method ?? "cod")] ?? "Cash on delivery";
  const paidBadge = online
    ? `<span style="font-size:12px;padding:2px 8px;border-radius:6px;background:${o.is_paid ? "#dcfce7;color:#166534" : "#fef3c7;color:#92400e"}">${o.is_paid ? "Paid" : "Unpaid"}</span>`
    : "";
  const placed = o.placed_at
    ? new Date(String(o.placed_at)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const willEarn = Math.floor(Number(o.total ?? 0) / 100);

  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-top:1px solid #eee">${esc(i.product_name)}<br><span style="color:#777;font-size:12px">${i.quantity}${i.unit === "kg" ? "kg" : "×"} @ ${money(i.unit_price)}</span></td><td style="padding:6px 0;border-top:1px solid #eee;text-align:right;white-space:nowrap">${money(i.line_total)}</td></tr>`
    )
    .join("");

  const totalRow = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;${strong ? "font-weight:700;border-top:1px solid #333" : "color:#555"}">${label}</td><td style="padding:3px 0;text-align:right;${strong ? "font-weight:700;border-top:1px solid #333" : ""}">${value}</td></tr>`;

  const discountRow = Number(o.discount ?? 0) > 0
    ? totalRow(`Discount${o.coupon_code ? " (" + esc(o.coupon_code) + ")" : ""}`, "-" + money(o.discount))
    : "";
  const pointsRow = Number(o.credit_used ?? 0) > 0
    ? totalRow(`Loyalty points (${Math.floor(Number(o.credit_used))})`, "-" + money(o.credit_used))
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
  <div style="background:#14532d;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">
    <div style="font-size:18px;font-weight:700">Farmers Fresh</div>
    <div style="font-size:12px;color:#bbf7d0">Fresh from our farms</div>
  </div>
  <div style="border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;padding:20px">
    <table style="width:100%;font-size:14px"><tr>
      <td style="vertical-align:top"><div style="color:#777;font-size:12px">Billed to</div><b>${esc(o.contact_name)}</b><br>${esc(o.contact_phone)}<br><span style="color:#777;font-size:12px">${esc(o.address_line)}${o.city ? ", " + esc(o.city) : ""}${o.pincode ? " - " + esc(o.pincode) : ""}</span></td>
      <td style="vertical-align:top;text-align:right"><div style="color:#777;font-size:12px">Receipt</div><b>${esc(o.order_number)}</b><br><span style="color:#777;font-size:12px">${esc(placed)}</span><br>${esc(payLabel)} ${paidBadge}</td>
    </tr></table>
    <table style="width:100%;font-size:14px;margin-top:14px;border-collapse:collapse">${rows}</table>
    <table style="width:100%;font-size:14px;margin-top:12px">
      ${totalRow("Subtotal", money(o.subtotal))}
      ${discountRow}
      ${pointsRow}
      ${totalRow("Delivery", Number(o.delivery_fee ?? 0) === 0 ? "Free" : money(o.delivery_fee))}
      ${totalRow("Total", money(o.total), true)}
    </table>
    <div style="margin-top:16px;background:#f0fdf4;color:#166534;padding:10px;border-radius:8px;text-align:center;font-size:13px">You'll earn ${willEarn} loyalty points when this order is delivered.</div>
    <div style="margin-top:16px;text-align:center"><a href="${SITE_URL}/receipt?number=${encodeURIComponent(String(o.order_number))}" style="display:inline-block;background:#16733e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">View &amp; print receipt</a></div>
    <p style="margin-top:16px;color:#999;font-size:12px;text-align:center">Thank you for shopping with Farmers Fresh. This is a computer-generated receipt.</p>
  </div>
</div>`;
}

// ---- channels -----------------------------------------------------------
async function sendEmail(n: Notif) {
  if (!RESEND_API_KEY) return { ok: false, skip: true };

  let html: string | undefined;
  if (n.template === "order.placed.customer") {
    const r = await fetchReceipt(n.payload.order_number);
    if (r) html = receiptHtml(r.o, r.items);
  }

  const body: Record<string, unknown> = {
    from: `Farmers Fresh <${FROM_EMAIL}>`,
    to: [n.recipient],
    subject: subjectFor(n.template, n.payload),
    text: bodyFor(n),
  };
  if (html) body.html = html;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, err: `resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}

async function sendSms(n: Notif) {
  if (!MSG91_AUTHKEY || !MSG91_SENDER) return { ok: false, skip: true };
  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { authkey: MSG91_AUTHKEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: MSG91_SENDER, short_url: "0",
      mobiles: `91${n.recipient}`, message: bodyFor(n).slice(0, 300),
    }),
  });
  if (!res.ok) return { ok: false, err: `msg91 ${res.status}: ${await res.text()}` };
  return { ok: true };
}

async function sendWhatsApp(n: Notif) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return { ok: false, skip: true };
  const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: `91${n.recipient}`,
      type: "text", text: { body: bodyFor(n) },
    }),
  });
  if (!res.ok) return { ok: false, err: `whatsapp ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// Web Push: `recipient` is the customer's user_id. Fan out to each of their
// devices; drop endpoints the browser has expired (404/410).
async function sendPush(n: Notif) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { ok: false, skip: true };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", n.recipient);
  if (!subs || subs.length === 0) return { ok: false, skip: true };

  const payload = JSON.stringify({
    title: "Farmers Fresh",
    body: bodyFor(n),
    url: targetUrl(n.payload),
  });

  let anyOk = false, lastErr = "";
  for (const s of subs as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      anyOk = true;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      lastErr = String((e as Error).message ?? e);
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return anyOk ? { ok: true } : { ok: false, err: lastErr || "push failed" };
}

Deno.serve(async () => {
  const { data: rows, error } = await admin
    .from("notifications")
    .select("id, channel, recipient, template, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0, skipped = 0, failed = 0;
  for (const n of (rows ?? []) as Notif[]) {
    const r = n.channel === "email" ? await sendEmail(n)
            : n.channel === "sms" ? await sendSms(n)
            : n.channel === "push" ? await sendPush(n)
            : await sendWhatsApp(n);
    const patch: Record<string, unknown> = {};
    if (r.skip) { patch.status = "skipped"; patch.last_error = "no provider key configured"; skipped++; }
    else if (r.ok) { patch.status = "sent"; patch.sent_at = new Date().toISOString(); sent++; }
    else { patch.status = "failed"; patch.last_error = r.err ?? "unknown"; failed++; }
    await admin.from("notifications").update(patch).eq("id", n.id);
  }
  return new Response(JSON.stringify({ sent, skipped, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
