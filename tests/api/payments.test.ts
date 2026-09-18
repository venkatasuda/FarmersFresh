import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
import { POST as webhook } from "../../app/api/razorpay/webhook/route";
import { POST as verify } from "../../app/api/razorpay/verify/route";
const secret = "ci-only-payment-secret";
const captured = { event: "payment.captured", payload: { payment: { entity: { id: "pay_ci", order_id: "order_ci", amount: 150000 } } } };
function hookRequest(body: string, signature = createHmac("sha256", secret).update(body).digest("hex")) {
  return new NextRequest("http://localhost/api/razorpay/webhook", { method: "POST", body, headers: { "x-razorpay-signature": signature } });
}
function verifyRequest(body: unknown) { return new NextRequest("http://localhost/api/razorpay/verify", { method: "POST", body: JSON.stringify(body) }); }
function callback(overrides = {}) { return { orderId: "shop_ci", razorpay_order_id: "order_ci", razorpay_payment_id: "pay_ci", razorpay_signature: createHmac("sha256", secret).update("order_ci|pay_ci").digest("hex"), ...overrides }; }
beforeEach(() => {
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", secret); vi.stubEnv("RAZORPAY_KEY_SECRET", secret);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ci-service-role"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  mocks.rpc.mockResolvedValue({ data: "order_paid", error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { razorpay_order_id: "order_ci" }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) });
});
afterEach(() => vi.unstubAllEnvs());
describe("webhook trust boundary", () => {
  it("fails closed when not configured", async () => { vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", ""); expect((await webhook(hookRequest("{}"))).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it.each(["", "bad", "0".repeat(64)])("rejects bad signature %s without DB work", async signature => { expect((await webhook(hookRequest(JSON.stringify(captured), signature))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("rejects body tampering", async () => { const raw = JSON.stringify(captured); const sig = createHmac("sha256", secret).update(raw).digest("hex"); expect((await webhook(hookRequest(raw.replace("150000", "1"), sig))).status).toBe(400); });
  it("rejects signed invalid JSON", async () => expect((await webhook(hookRequest("{"))).status).toBe(400));
  it("ignores uncaptured events", async () => { expect((await webhook(hookRequest('{"event":"payment.authorized"}'))).status).toBe(200); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("ignores missing payment entity", async () => { expect((await webhook(hookRequest('{"event":"payment.captured"}'))).status).toBe(200); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("passes exact signed amount and identifiers to settlement", async () => { expect((await webhook(hookRequest(JSON.stringify(captured)))).status).toBe(200); expect(mocks.rpc).toHaveBeenCalledWith("settle_razorpay_payment", { p_payment_id: "pay_ci", p_rp_order: "order_ci", p_amount: 150000, p_event: "payment.captured", p_raw: captured }); });
  it("acknowledges duplicate events without duplicating application logic", async () => { mocks.rpc.mockResolvedValue({ data: "duplicate", error: null }); expect(await (await webhook(hookRequest(JSON.stringify(captured)))).json()).toEqual({ ok: true, status: "duplicate" }); });
  it("asks provider to retry DB failure and hides internals", async () => { mocks.rpc.mockResolvedValue({ data: null, error: { message: "password=private" } }); const res = await webhook(hookRequest(JSON.stringify(captured))); expect(res.status).toBe(500); expect(await res.json()).toEqual({ error: "settle failed" }); });
  it("covers event without name and missing amount forwarding", async () => { expect((await webhook(hookRequest("{}"))).status).toBe(200); const event = structuredClone(captured); Reflect.deleteProperty(event.payload.payment.entity, "amount"); await webhook(hookRequest(JSON.stringify(event))); expect(mocks.rpc.mock.calls.at(-1)?.[1].p_amount).toBeNull(); });
});
describe("browser payment callback", () => {
  it("fails closed without payment configuration", async () => { vi.stubEnv("RAZORPAY_KEY_SECRET", ""); expect((await verify(verifyRequest(callback()))).status).toBe(503); });
  it("rejects malformed JSON and incomplete fields", async () => { expect((await verify(new NextRequest("http://localhost", { method: "POST", body: "{" }))).status).toBe(400); expect((await verify(verifyRequest({}))).status).toBe(400); });
  it("rejects forged signatures", async () => { expect((await verify(verifyRequest(callback({ razorpay_signature: "fake" })))).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled(); });
  it("rejects a valid cheap payment replayed against another order", async () => { mocks.maybeSingle.mockResolvedValue({ data: { razorpay_order_id: "expensive_order" } }); expect((await verify(verifyRequest(callback()))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("rejects nonexistent shop order", async () => { mocks.maybeSingle.mockResolvedValue({ data: null }); expect((await verify(verifyRequest(callback()))).status).toBe(400); });
  it("settles a verified matching callback", async () => { expect((await verify(verifyRequest(callback()))).status).toBe(200); expect(mocks.rpc).toHaveBeenCalledWith("mark_order_paid", { p_order_id: "shop_ci", p_razorpay_order: "order_ci", p_razorpay_payment: "pay_ci" }); });
  it("returns retryable DB error without leaking internals", async () => { mocks.rpc.mockResolvedValue({ error: { message: "private" } }); expect((await verify(verifyRequest(callback()))).status).toBe(500); });
});
