"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "./push-actions";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// VAPID keys are base64url; PushManager wants an ArrayBuffer-backed view.
// Backing it with an explicit ArrayBuffer keeps TypeScript's newer generic
// Uint8Array happy with applicationServerKey's BufferSource type.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToB64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

/**
 * "Get notified" — opts this device into Web Push for order updates and deals.
 * Renders nothing unless a VAPID public key is configured, so it never shows a
 * dead control before push is set up. Push also needs an installed service
 * worker (already registered app-wide) and the customer's permission.
 */
export function NotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !VAPID_PUBLIC ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }
    setSupported(true);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(!!sub))
      .catch(() => {});
  }, []);

  if (!supported) return null;

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications are blocked. Allow them in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!),
      });
      const r = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: keyToB64(sub, "p256dh"),
        auth: keyToB64(sub, "auth"),
      });
      if (!r.ok) {
        setError("Couldn't save your subscription. Please try again.");
        return;
      }
      setOn(true);
    } catch {
      setError("Couldn't enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setOn(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-ink">Notifications on this device</p>
        <p className="text-xs text-ink-soft">
          Order updates, payment confirmations and deal alerts — even when the
          app is closed.
        </p>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={on ? disable : enable}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
          on
            ? "border border-line text-ink-soft hover:border-brand-300 hover:text-brand-700"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {busy ? "…" : on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
