import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/server/supabase/admin";
import { RequestError } from "./http";

// Global ceilings remain effective even behind a proxy that does not provide a
// trustworthy client IP. Configure RATE_LIMIT_IP_HEADER only for an overwritten
// ingress header; never trust arbitrary browser-supplied forwarding headers.
export async function enforceRateLimit(scope: string, headers: Headers, limit = 30) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new RequestError(503, "Service temporarily unavailable.");
  const header = process.env.VERCEL ? "x-vercel-forwarded-for" : process.env.RATE_LIMIT_IP_HEADER;
  const identity = header ? headers.get(header)?.split(",")[0].trim() : null;
  const admin = createAdminClient(url, secret);
  for (const [key, cap] of [["global", limit * 20], [identity || "shared", limit]] as const) {
    const hash = createHmac("sha256", secret).update(`${scope}:${key}`).digest("hex");
    const { data, error } = await admin.rpc("consume_request_limit", { p_key: hash, p_limit: cap });
    if (error) throw new RequestError(503, "Service temporarily unavailable.");
    if (data !== true) throw new RequestError(429, "Too many requests. Please try again in a minute.");
  }
}

