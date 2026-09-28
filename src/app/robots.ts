import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmersfresh.store";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Never index authenticated, transactional or API routes.
        disallow: [
          "/dashboard",
          "/account",
          "/checkout",
          "/api",
          "/auth",
          "/login",
          "/track",
          "/receipt",
          "/order-placed",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
