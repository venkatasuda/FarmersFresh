"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary. This catches a crash in the ROOT layout itself — the
 * one case a normal error.tsx can't reach, because error.tsx renders inside
 * the layout that just failed. It must therefore render its own <html> and
 * <body>. If you ever see this, something very low-level broke; the goal is
 * simply to show something human and offer a reload rather than a raw stack.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6faf7",
          color: "#14231a",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Farmers Fresh is temporarily unavailable
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#5c6b62", fontSize: "0.9rem" }}>
            We hit an unexpected problem. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              borderRadius: "0.5rem",
              background: "#16a34a",
              color: "#fff",
              border: "none",
              padding: "0.6rem 1.1rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
