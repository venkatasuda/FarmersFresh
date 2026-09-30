import "server-only";
import type { HamperCard, HamperDetail } from "@/lib/contracts/hampers";
import { createClient } from "@/server/supabase/server";

export async function getHampers(): Promise<HamperCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_hampers");
  return ((data ?? []) as Record<string, unknown>[]).map((h) => ({
    id: String(h.id),
    name: String(h.name ?? ""),
    imagePath: (h.image_path as string | null) ?? null,
    cost: Number(h.cost ?? 0),
    itemCount: Number(h.item_count ?? 0),
  }));
}

export async function getHamperDetail(id: string): Promise<HamperDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_hamper", { p_id: id });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  return {
    id: String(d.id),
    name: String(d.name ?? ""),
    description: (d.description as string | null) ?? null,
    items: items.map((i) => ({
      productId: String(i.product_id),
      slug: String(i.slug ?? ""),
      name: String(i.name ?? ""),
      unit: (i.unit as "kg" | "piece") ?? "piece",
      price: Number(i.price ?? 0),
      imagePath: (i.image_path as string | null) ?? null,
      packSize: i.pack_size == null ? null : Number(i.pack_size),
      qty: Number(i.qty ?? 0),
      lineCost: Number(i.line_cost ?? 0),
    })),
  };
}
