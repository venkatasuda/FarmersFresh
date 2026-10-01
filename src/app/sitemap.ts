import { getPublishedProductSlugs } from "@/server/catalogue/queries";
import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmersfresh.store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/offers",
    "/recipes",
    "/hampers",
    "/pass",
    "/about",
    "/contact",
    "/delivery-info",
    "/returns",
    "/privacy",
    "/terms",
  ].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.6,
  }));

  // Published products (RLS keeps this to the public storefront). Resilient:
  // if the query fails, we still return the static routes.
  let products: MetadataRoute.Sitemap = [];
  try {
    const data = await getPublishedProductSlugs();
    products = ((data ?? []) as { slug: string | null; updated_at: string | null }[])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${base}/shop/${p.slug}`,
        lastModified: p.updated_at ?? undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      }));
  } catch {
    /* keep static routes only */
  }

  return [...staticRoutes, ...products];
}
