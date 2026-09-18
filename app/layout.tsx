import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/app/(shop)/cart-context";
import { CartDrawer } from "@/app/(shop)/cart-drawer";
import { CartToast } from "@/app/(shop)/cart-toast";
import { WishlistProvider } from "@/app/(shop)/wishlist-context";
import { ServiceWorkerRegister } from "@/app/(shop)/sw-register";
import { getStoreSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmersfresh.store"
  ),
  title: {
    default: "Farmers Fresh",
    template: "%s",
  },
  description:
    "Fresh meat and everyday groceries from our own farms, delivered to your door. Pay on delivery.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Farmers Fresh",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  // Social preview (the generated app/opengraph-image is picked up automatically).
  openGraph: {
    type: "website",
    siteName: "Farmers Fresh",
    title: "Farmers Fresh — Indian groceries & fresh meat, delivered",
    description:
      "Everyday groceries plus meat from our own farms. Honest prices, no hidden fees. Pay on delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Farmers Fresh — Indian groceries & fresh meat, delivered",
    description:
      "Everyday groceries plus meat from our own farms. Honest prices, no hidden fees.",
  },
};

// Theme colour tints the browser chrome on mobile — a small touch that makes
// the site feel like an app.
export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The free-delivery threshold powers the basket's "spend X more" nudge, so it
  // must reflect the owner's setting, not a hardcoded number.
  const settings = await getStoreSettings();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The basket must survive navigation between product pages, so the
            provider sits above the router outlet. It is inert on staff pages. */}
        <WishlistProvider>
          <CartProvider freeDeliveryThreshold={settings.freeDeliveryThreshold}>
            {children}
            <CartDrawer />
            <CartToast />
          </CartProvider>
        </WishlistProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
