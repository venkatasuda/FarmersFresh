"use client";

import { useEffect } from "react";

const KEY = "ff.recent.v1";
const MAX = 8;

/**
 * Records that this product was viewed, into localStorage — the browsing
 * signal behind "recently viewed" and a customer's personalized feed. Kept
 * entirely on the device: private, no server logging, and it works with zero
 * orders on day one. Renders nothing.
 */
export function TrackView({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      const prev: string[] = raw ? JSON.parse(raw) : [];
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(
        0,
        MAX
      );
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked (private mode) — personalization simply doesn't build.
    }
  }, [productId]);

  return null;
}

/** Read the visitor's recently-viewed ids (most recent first). */
export function readRecentlyViewed(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
