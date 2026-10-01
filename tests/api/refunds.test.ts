import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ request: vi.fn(), record: vi.fn(), fetch: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.request }) }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.record }) }));
import { refundOrder } from "@/server/payments/refund";
import { POST as webhook } from "@/app/api/razorpay/webhook/route";
const id = "11111111-1111-4111-8111-111111111111";
const refund = { id, payment_id: "pay_ci", amount: 12000, provider_id: null, status: "pending" };
const processed = { id: "rfnd_ci", payment_id: "pay_ci", amount: 12000, currency: "INR", status: "processed" };
beforeEach(() => {
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_ci"); vi.stubEnv("RAZORPAY_KEY_SECRET", "ci-secret");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "ci-secret"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ci-service"); vi.stubGlobal("fetch", mocks.fetch);
  mocks.request.mockResolvedValue({ data: refund, error: null }); mocks.record.mockResolvedValue({ data: "processed", error: null });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => processed });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("fails closed before requesting a refund when keys are missing", async () => {
  vi.stubEnv("RAZORPAY_KEY_SECRET", ""); expect((await refundOrder(id)).ok).toBe(false); expect(mocks.request).not.toHaveBeenCalled();
});
it("never contacts the provider after a database authorization rejection", async () => {
  mocks.request.mockResolvedValue({ error: { message: "private" }, data: null });
  expect((await refundOrder(id)).ok).toBe(false); expect(mocks.fetch).not.toHaveBeenCalled();
});
it("uses the database amount and the same idempotency key for duplicate requests", async () => {
  await refundOrder(id); await refundOrder(id);
  for (const call of mocks.fetch.mock.calls) {
    expect(call[0]).toBe("https://api.razorpay.com/v1/payments/pay_ci/refund");
    expect(call[1].headers["X-Refund-Idempotency"]).toBe(id);
    expect(JSON.parse(call[1].body)).toEqual({ amount: 12000 });
  }
  expect(mocks.record).toHaveBeenCalledWith("record_order_refund", { p_refund_id: "rfnd_ci", p_payment_id: "pay_ci", p_amount: 12000, p_status: "processed" });
});
it("checks an existing provider refund without submitting more money", async () => {
  mocks.request.mockResolvedValue({ data: { ...refund, provider_id: "rfnd_ci" }, error: null });
  expect((await refundOrder(id)).ok).toBe(true);
  expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.razorpay.com/v1/refunds/rfnd_ci");
  expect(mocks.fetch.mock.calls[0][1].method).toBe("GET");
});
it.each([{ ...processed, amount: 1 }, { ...processed, payment_id: "pay_other" }, { ...processed, currency: "USD" }])("rejects mismatched provider data", async result => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => result });
  expect((await refundOrder(id)).ok).toBe(false); expect(mocks.record).not.toHaveBeenCalled();
});
it("keeps an ambiguous timeout retryable and hides provider errors", async () => {
  mocks.fetch.mockRejectedValue(new Error("private credentials")); const result = await refundOrder(id);
  expect(result.ok).toBe(false); expect(result.message).not.toContain("credentials"); expect(mocks.record).not.toHaveBeenCalled();
});
it("does not resubmit processed or terminal failed refunds", async () => {
  for (const status of ["processed", "failed"]) {
    mocks.request.mockResolvedValue({ data: { ...refund, status }, error: null });
    expect((await refundOrder(id)).ok).toBe(status === "processed");
  }
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("reconciles signed refund events and rejects inconsistent status", async () => {
  const request = (entity: typeof processed) => {
    const body = JSON.stringify({ event: "refund.processed", payload: { refund: { entity } } });
    return new NextRequest("http://localhost/api/razorpay/webhook", { method: "POST", body,
      headers: { "x-razorpay-signature": createHmac("sha256", "ci-secret").update(body).digest("hex") } });
  };
  expect((await webhook(request(processed))).status).toBe(200);
  expect(mocks.record).toHaveBeenCalledWith("record_order_refund", { p_refund_id: "rfnd_ci", p_payment_id: "pay_ci", p_amount: 12000, p_status: "processed" });
  expect((await webhook(request({ ...processed, status: "pending" }))).status).toBe(400);
});
