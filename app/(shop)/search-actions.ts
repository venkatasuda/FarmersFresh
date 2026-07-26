"use server";

import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

export type Suggestion = {
  slug: string;
  name: string;
  price: number;
  imagePath: string | null;
  category: string | null;
};

/**
 * Lightweight autocomplete: a few product matches for the search dropdown.
 * A direct name search rather than the full catalogue load, so it's fast on
 * every keystroke. RLS (prod_public_read) keeps it to published storefront
 * products, so no extra filtering is needed.
 */
export async function suggestProducts(q: string): Promise<Suggestion[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name, sale_price, image_path, category")
    .ilike("name", `%${term}%`)
    .limit(6);

  if (error) return [];

  return (
    (data ?? []) as {
      slug: string | null;
      name: string;
      sale_price: string | number | null;
      image_path: string | null;
      category: string | null;
    }[]
  )
    .filter((r) => r.slug)
    .map((r) => ({
      slug: r.slug as string,
      name: r.name,
      price: num(r.sale_price),
      imagePath: r.image_path,
      category: r.category,
    }));
}
