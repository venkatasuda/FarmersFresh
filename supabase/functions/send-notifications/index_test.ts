// Native Deno test, with network access denied by CI. No real messages or keys.
import assert from "node:assert/strict";

Deno.test("worker authorization, provider delivery/failures, durable status and email retry identity", async () => {
  const originalFetch = globalThis.fetch, originalServe = Deno.serve;
  const settings = { SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "ci-only",
    RESEND_API_KEY: "ci-only", MSG91_AUTHKEY: "ci-only", MSG91_SENDER: "CI",
    NOTIFICATION_WORKER_SECRET: "ci-only-worker-token-0000000000000000" };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, Deno.env.get(key)]));
  let handler: (request: Request) => Promise<Response>;
  let queueError = false, saveError = false, calls = 0;
  let rows = [
    { id: 1, channel: "email", recipient: "customer@example.invalid", template: "order.confirmed.customer", payload: { order_number: "DEMO-1" } },
    { id: 2, channel: "sms", recipient: "9000000000", template: "order.confirmed.customer", payload: { order_number: "DEMO-2" } },
  ];
  const patches: Record<string, unknown>[] = [], emailKeys: (string | null)[] = [];
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  try {
    for (const [key, value] of Object.entries(settings)) Deno.env.set(key, value);
    Object.defineProperty(Deno, "serve", { value: (callback: typeof handler) => { handler = callback; }, configurable: true });
    globalThis.fetch = (input, init) => {
      calls++;
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname === "127.0.0.1" && url.pathname === "/rest/v1/rpc/claim_notifications")
        return Promise.resolve(queueError ? json({ message: "private database detail" }, 500) : json(rows));
      if (url.hostname === "127.0.0.1" && url.pathname === "/rest/v1/notifications") {
        patches.push(JSON.parse(String(init?.body)));
        return Promise.resolve(saveError ? json({ message: "private database detail" }, 500) : json(null));
      }
      if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
        emailKeys.push(new Headers(init?.headers).get("Idempotency-Key")); return Promise.resolve(json({ id: "ci-email" }));
      }
      if (url.hostname === "control.msg91.com") return Promise.resolve(json({ message: "private provider detail" }, 503));
      throw new Error("Unexpected network destination in synthetic test");
    };
    await import("./index.ts");
    const request = (authorized = true) => new Request("http://localhost/worker", { method: "POST",
      headers: authorized ? { Authorization: `Bearer ${settings.NOTIFICATION_WORKER_SECRET}` } : {} });
    assert.equal((await handler!(request(false))).status, 401); assert.equal(calls, 0);
    assert.deepEqual(await (await handler!(request())).json(), { sent: 1, skipped: 0, failed: 1 });
    assert.equal(patches[0].status, "sent"); assert.equal(patches[1].status, "failed");
    assert(!String(patches[1].last_error).includes("private"));
    rows = [rows[0]]; saveError = true;
    const failure = await handler!(request()); assert.equal(failure.status, 500);
    assert(!JSON.stringify(await failure.json()).includes("private"));
    saveError = false; await handler!(request());
    assert.deepEqual(emailKeys, ["notification-1", "notification-1", "notification-1"]);
    queueError = true; const queueFailure = await handler!(request()); assert.equal(queueFailure.status, 500);
    assert(!JSON.stringify(await queueFailure.json()).includes("private"));
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true });
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value); }
  }
});
