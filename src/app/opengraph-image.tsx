import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Farmers Fresh — Indian groceries & fresh meat, delivered";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically generated OG/Twitter card — on-brand, no static asset to ship.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #166534 0%, #14532d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 2, opacity: 0.85 }}>
          FARMERS FRESH
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 24 }}>
          Indian groceries &amp; fresh meat, delivered.
        </div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#bbf7d0" }}>
          From our own farms · honest prices · no hidden fees
        </div>
      </div>
    ),
    { ...size }
  );
}
