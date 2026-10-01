import { createHash, timingSafeEqual } from "node:crypto";

export function workerAuthorized(request: Request, secret: string | undefined): boolean {
  if (request.method !== "POST" || !secret || secret.length < 32) return false;
  const actual = request.headers.get("authorization") ?? "";
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(`Bearer ${secret}`).digest());
}

export function trustedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 2048 && url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname);
  } catch { return false; }
}
