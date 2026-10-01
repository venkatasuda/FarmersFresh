import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/server/supabase/admin";

export async function metrics(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  const token = process.env.MONITORING_TOKEN;
  if (!token || token.length < 32) return new Response("Unavailable", { status: 503, headers });
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return new Response("Unavailable", { status: 503, headers });
  try {
    const { data, error } = await createAdminClient(url, secret).rpc("operations_metrics").abortSignal(AbortSignal.timeout(5000));
    if (error || !Array.isArray(data)) throw new Error();
    const lines = data.map((row: { metric: string; value: unknown }) => {
      const value = Number(row.value);
      if (!/^ff_[a-z0-9_]+$/.test(row.metric) || !Number.isSafeInteger(value) || value < 0) throw new Error();
      return `# TYPE ${row.metric} gauge\n${row.metric} ${value}\n`;
    });
    return new Response(lines.join(""), { headers: { ...headers, "Content-Type": "text/plain; version=0.0.4; charset=utf-8" } });
  } catch { return new Response("Unavailable", { status: 503, headers }); }
}
