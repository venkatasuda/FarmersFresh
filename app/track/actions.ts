"use server";

import { createClient } from "@/lib/supabase/server";

export type TrackedItem = {
  name: string;
  quantity: number;
  unit: string;
  lineTotal: number;
  slug: string | null;
};

export type TrackedOrder = {
  orderNumber: string;
  status:
    | "placed"
    | "confirmed"
    | "packed"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";
  total: number;
  subtotal: number;
  deliveryFee: number;
  placedAt: string;
  deliverySlot: string | null;
  contactName: string;
  cancelledReason: string | null;
  items: TrackedItem[];
  tracking: {
    lat: number;
    lng: number;
    updatedAt: string;
    etaMinutes: number | null;
    etaSetAt: string | null;
  } | null;
};

export type TrackResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; message: string };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export async function rateDelivery(
  orderNumber: string,
  phone: string,
  rating: number,
  comment: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rate_delivery", {
    p_number: orderNumber,
    p_phone: phone,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) return { ok: false, message: "Couldn't submit. Try again." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return { ok: !!d.ok, message: d.message ?? "" };
}

export async function tipDelivery(
  orderNumber: string,
  points: number
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tip_delivery", {
    p_number: orderNumber,
    p_points: points,
  });
  if (error) return { ok: false, message: "Couldn't tip just now. Try again." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return { ok: !!d.ok, message: d.message };
}

export async function trackOrder(
  orderNumber: string,
  phone: string
): Promise<TrackResult> {
  if (!orderNumber.trim() || !phone.trim()) {
    return { ok: false, message: "Enter your order number and phone." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_order", {
    p_number: orderNumber,
    p_phone: phone,
  });

  if (error) {
    return { ok: false, message: "Couldn't check that right now. Try again." };
  }

  // Null = not found or phone mismatch. Deliberately one vague message so we
  // never confirm an order number exists to someone who can't prove it's theirs.
  if (!data) {
    return {
      ok: false,
      message:
        "We couldn't find an order with that number and phone. Check both and try again.",
    };
  }

  const d = data as Record<string, unknown>;
  return {
    ok: true,
    order: {
      orderNumber: String(d.order_number),
      status: d.status as TrackedOrder["status"],
      total: num(d.total),
      subtotal: num(d.subtotal),
      deliveryFee: num(d.delivery_fee),
      placedAt: String(d.placed_at),
      deliverySlot: (d.delivery_slot as string) ?? null,
      contactName: String(d.contact_name),
      cancelledReason: (d.cancelled_reason as string) ?? null,
      items: ((d.items as unknown[]) ?? []).map((i) => {
        const it = i as Record<string, unknown>;
        return {
          name: String(it.name),
          quantity: num(it.quantity),
          unit: String(it.unit),
          lineTotal: num(it.line_total),
          slug: (it.slug as string) ?? null,
        };
      }),
      tracking: (() => {
        const t = d.tracking as Record<string, unknown> | null;
        if (!t || t.lat == null || t.lng == null) return null;
        return {
          lat: num(t.lat),
          lng: num(t.lng),
          updatedAt: String(t.updated_at ?? ""),
          etaMinutes: t.eta_minutes == null ? null : num(t.eta_minutes),
          etaSetAt: (t.eta_set_at as string) ?? null,
        };
      })(),
    },
  };
}
