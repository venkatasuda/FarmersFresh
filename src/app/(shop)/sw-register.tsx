"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after the page loads. Kept in its own tiny
 * client component, mounted once at the root, so the rest of the app stays
 * server-rendered. Failures are swallowed — a browser without service-worker
 * support (or a blocked registration) just doesn't get offline mode.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
