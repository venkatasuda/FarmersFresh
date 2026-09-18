import type { NextConfig } from "next";

// Derive the Supabase Storage host from the project URL so this config is
// portable across projects/environments (no hardcoded project ref).
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "supabase.co";
  }
})();

const nextConfig: NextConfig = {
  images: {
    /**
     * Remote image hosts allowed through next/image.
     *
     * Only add hosts whose licence actually permits commercial use. Unsplash
     * and Pexels do; a Google Images result almost certainly does not, and a
     * food business using another company's product photography is a real
     * legal exposure, not a theoretical one.
     *
     * These are PLACEHOLDERS for building. Ship with your own photos of your
     * own meat, served from Supabase Storage — see docs/BRAND.md.
     */
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Next.js 16 defaults to qualities [75]. Meat photography needs a little
    // more headroom, so allow 90 for hero shots.
    qualities: [75, 90],
  },

  // Security headers applied to every response. HSTS forces HTTPS on repeat
  // visits; the rest are cheap hardening. No Permissions-Policy lock on
  // geolocation/camera — the app legitimately uses both (delivery pin, visual
  // search).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
