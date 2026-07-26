import { createClient } from "@/lib/supabase/server";
import { Stars } from "./stars";
import { ReviewForm } from "./review-form";

type Review = {
  author_name: string;
  rating: number;
  body: string | null;
  verified: boolean;
  created_at: string;
};

/**
 * Reviews block for a product page: the summary, the list, and the write-a-
 * review form. A server component that loads the reviews, with the form as a
 * client island inside it.
 */
export async function Reviews({
  productId,
  avgRating,
  reviewCount,
}: {
  productId: string;
  avgRating: number | null;
  reviewCount: number;
}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_product_reviews", {
    p_product: productId,
    p_limit: 20,
  });
  const reviews = (data ?? []) as Review[];

  return (
    <section id="reviews" className="mt-12 scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        Ratings & reviews
      </h2>

      {avgRating !== null ? (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-3xl font-semibold text-ink">{avgRating}</span>
          <div>
            <Stars rating={avgRating} className="size-4" />
            <p className="text-xs text-ink-soft">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-ink-soft">
          No reviews yet — be the first to rate this.
        </p>
      )}

      <ReviewForm productId={productId} />

      {reviews.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {reviews.map((r, i) => (
            <li key={i} className="border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-sm font-medium text-ink">
                  {r.author_name}
                </span>
                {r.verified ? (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-800">
                    Verified purchase
                  </span>
                ) : null}
              </div>
              {r.body ? (
                <p className="mt-1.5 text-sm text-ink-soft">{r.body}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-soft/70">
                {new Date(r.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
