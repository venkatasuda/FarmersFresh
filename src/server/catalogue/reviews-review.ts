import "server-only";
import type { ReviewResult } from "@/lib/contracts/reviews-review";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitReview(
  productId: string,
  slug: string,
  name: string,
  rating: number,
  body: string
): Promise<ReviewResult> {
  if (rating < 1 || rating > 5) {
    return { ok: false, message: "Pick a rating." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_review", {
    p_product: productId,
    p_name: name,
    p_rating: rating,
    p_body: body || null,
  });

  if (error) return { ok: false, message: "Couldn't post that. Try again." };

  const d = data as { ok?: boolean; message?: string; verified?: boolean };
  if (!d.ok) return { ok: false, message: d.message ?? "Couldn't post that." };

  revalidatePath(`/shop/${slug}`);
  return { ok: true, verified: !!d.verified };
}
