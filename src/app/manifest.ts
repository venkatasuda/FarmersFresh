import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes the site installable as an app on a phone home screen,
 * and gives it a name, colour and standalone chrome when launched.
 *
 * Icon is the branded SVG (works for the manifest, theme colour, and iOS
 * add-to-home). For a full Android install prompt, add 192×192 and 512×512
 * PNG exports of the logo and list them here too — see docs/PWA.md.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Farmers Fresh",
    short_name: "Farmers Fresh",
    description:
      "Fresh meat and everyday groceries from our own farms, delivered.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6faf7",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
