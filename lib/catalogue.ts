/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 *
 * The STAFF view of the catalogue. Unlike `lib/shop.ts`, this returns
 * unpublished and retired products too, because that is the point of an
 * admin screen.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { AdminProduct, Brand, Category } from "@/lib/types";

type Row = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  unit: "kg" | "piece";
  sale_price: string | number | null;
  compare_at_price: string | number | null;
  pack_size: string | number | null;
  pack_unit: AdminProduct["packUnit"];
  badge: string | null;
  image_path: string | null;
  category_id: string | null;
  brand_id: string | null;
  is_published: boolean;
  is_active: boolean;
  sort_order: number;
};

function toAdmin(r: Row, onHand: number): AdminProduct {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    unit: r.unit,
    salePrice: r.sale_price === null ? null : num(r.sale_price),
    compareAtPrice: r.compare_at_price === null ? null : num(r.compare_at_price),
    packSize: r.pack_size === null ? null : num(r.pack_size),
    packUnit: r.pack_unit,
    badge: r.badge,
    imagePath: r.image_path,
    categoryId: r.category_id,
    brandId: r.brand_id,
    isPublished: r.is_published,
    isActive: r.is_active,
    sortOrder: r.sort_order,
    onHand,
  };
}

const SELECT =
  "id, name, slug, description, unit, sale_price, compare_at_price, pack_size, pack_unit, badge, image_path, category_id, brand_id, is_published, is_active, sort_order";

export async function getAdminProducts(
  includeRetired = false
): Promise<AdminProduct[]> {
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeRetired) query = query.eq("is_active", true);

  const [{ data, error }, stock] = await Promise.all([
    query,
    supabase.from("stock_on_hand").select("product_id, quantity"),
  ]);

  if (error) {
    console.error("getAdminProducts failed:", error.message);
    return [];
  }

  const onHand = new Map(
    ((stock.data ?? []) as { product_id: string; quantity: string | number }[]).map(
      (r) => [r.product_id, num(r.quantity)]
    )
  );

  return ((data ?? []) as Row[]).map((r) => toAdmin(r, onHand.get(r.id) ?? 0));
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toAdmin(data as Row, 0);
}

/** Flat category list for a <select>. Staff see all of them, live or not. */
export async function getAdminCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, icon, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getAdminCategories failed:", error.message);
    return [];
  }

  return (
    (data ?? []) as {
      id: string;
      parent_id: string | null;
      slug: string;
      name: string;
      icon: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    slug: r.slug,
    name: r.name,
    icon: r.icon,
    productCount: 0,
  }));
}

export async function getBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("slug, name, tagline, description, is_primary, id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getBrands failed:", error.message);
    return [];
  }

  return (
    (data ?? []) as {
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      description: string | null;
      is_primary: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    isPrimary: r.is_primary,
  }));
}
