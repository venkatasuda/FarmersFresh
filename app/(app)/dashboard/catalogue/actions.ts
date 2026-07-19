"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type ProductInput = {
  id: string | null;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  salePrice: number | null;
  compareAtPrice: number | null;
  description: string;
  packSize: number | null;
  packUnit: string | null;
  badge: string;
  imagePath: string | null;
  isPublished: boolean;
  sortOrder: number;
};

/**
 * Every rule worth enforcing lives in `save_product` in the database, not
 * here. This is a thin translator. The checks below exist only to give a
 * faster, friendlier message — they are not the protection, and deleting
 * them would change nothing about what the database will accept.
 */
export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  if (!input.name.trim()) {
    return { ok: false, message: "Give the product a name." };
  }

  if (
    input.compareAtPrice !== null &&
    input.salePrice !== null &&
    input.compareAtPrice <= input.salePrice
  ) {
    return {
      ok: false,
      message:
        "The 'was' price must be higher than the selling price — otherwise it isn't a discount.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_product", {
    p_id: input.id,
    p_name: input.name,
    p_category_id: input.categoryId,
    p_brand_id: input.brandId,
    p_sale_price: input.salePrice,
    p_compare_at_price: input.compareAtPrice,
    p_description: input.description,
    p_pack_size: input.packSize,
    p_pack_unit: input.packUnit,
    p_badge: input.badge,
    p_image_path: input.imagePath,
    p_is_published: input.isPublished,
    p_sort_order: input.sortOrder,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/stock");
  revalidatePath("/");
  return { ok: true, id: String(data) };
}

export async function retireProduct(
  id: string,
  reason: string
): Promise<SaveResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("retire_product", {
    p_id: id,
    p_reason: reason || "Line discontinued",
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/");
  return { ok: true, id };
}

/** Quick publish/unpublish from the list, without opening the editor. */
export async function togglePublished(
  id: string,
  next: boolean
): Promise<SaveResult> {
  const supabase = await createClient();

  // Straight UPDATE rather than save_product: RLS already restricts this to
  // the org, and the products_publishable CHECK constraint still refuses to
  // publish anything without a slug and a price.
  const { error } = await supabase
    .from("products")
    .update({ is_published: next })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      message: error.message.includes("products_publishable")
        ? "Add a price before putting this on the shop."
        : error.message,
    };
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/");
  return { ok: true, id };
}
