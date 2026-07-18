import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/app/(shop)/cart-context";
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
  title: {
    default: "Farmers Fresh",
    template: "%s",
  },
  description:
    "Fresh meat from our own farms, delivered to your door. Pay on delivery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The basket must survive navigation between product pages, so the
            provider sits above the router outlet. It is inert on staff pages. */}
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
