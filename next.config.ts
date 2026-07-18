import type { NextConfig } from "next";

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
        hostname: "bjevoybwufubtprkxbvb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Next.js 16 defaults to qualities [75]. Meat photography needs a little
    // more headroom, so allow 90 for hero shots.
    qualities: [75, 90],
  },
};

export default nextConfig;
