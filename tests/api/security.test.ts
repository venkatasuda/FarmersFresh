import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { apiRequest, readObject } from "@/server/security/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { canPay, grantGuestPayment } from "@/server/payments/access";
import { capturedPayment } from "@/server/payments/captured";
import { safeImage } from "@/server/catalogue/images";
import { safeNext } from "@/lib/guard";
import { supabaseAnonKey } from "@/lib/env";
import { workerAuthorized, trustedPushEndpoint } from "../../supabase/functions/send-notifications/security";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), cookies: new Map<string, string>() }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mock.rpc }) }));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.getUser } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => ({ value: mock.cookies.get(name) }), set: (name: string, value: string) => mock.cookies.set(name, value) }) }));
beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
  vi.stubEnv("RAZORPAY_KEY_ID", "test"); vi.stubEnv("RAZORPAY_KEY_SECRET", "test");
  mock.cookies.clear(); mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const request = (body: string, headers = {}) => new NextRequest("http://localhost/api/test", { method: "POST", body, headers });

describe("request boundaries", () => {
  it("rejects privileged keys in public configuration", () => {
    for (const key of ["sb_secret_test", `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test`]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
      expect(() => supabaseAnonKey()).toThrow();
    }
  });
  it.each(["null", "[]", "1", '"text"', "{"])("rejects non-object input %s", async body => {
    const response = await apiRequest(request(body), async r => Response.json(await readObject(r)));
    expect(response.status).toBe(400);
  });
  it("bounds actual bytes without trusting content-length", async () => {
    const response = await apiRequest(request('"' + "x".repeat(50) + '"'), async r => Response.json(await readObject(r, 20)));
    expect(response.status).toBe(413);
  });
  it("rejects cross-origin writes before database work", async () => {
    const response = await apiRequest(request("{}", { origin: "https://attacker.test" }), async () => Response.json({}), "payment");
    expect(response.status).toBe(403); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("returns retry advice and fails closed when limiter is unavailable", async () => {
    mock.rpc.mockResolvedValue({ data: false });
    const response = await apiRequest(request("{}"), async () => Response.json({}), "payment");
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60");
    mock.rpc.mockResolvedValue({ error: { message: "password=private" } });
    await expect(enforceRateLimit("payment", new Headers())).rejects.toMatchObject({ status: 503 });
  });
  it("hides unexpected exceptions", async () => {
    const response = await apiRequest(request("{}"), async () => { throw new Error("secret database URL"); });
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("secret");
  });
  it.each(["//evil.test", "/\\evil.test", "/\nevil", "https://evil.test"])("blocks redirect escape %s", value => expect(safeNext(value)).toBe("/dashboard"));
});
describe("payment ownership and captured money", () => {
  it("accepts only the record owner", async () => {
    expect(await canPay("record", "owner")).toBe(true);
    expect(await canPay("record", "other")).toBe(false);
    expect(await canPay("record", null)).toBe(false);
  });
  it("guest proof is order-bound, tamper-resistant and expires", async () => {
    vi.useFakeTimers();
    await grantGuestPayment("one");
    expect(await canPay("one", null, true)).toBe(true);
    expect(await canPay("two", null, true)).toBe(false);
    const valid = mock.cookies.get("ff-pay-one")!;
    mock.cookies.set("ff-pay-two", valid);
    expect(await canPay("two", null, true)).toBe(false);
    vi.advanceTimersByTime(3_600_001);
    expect(await canPay("one", null, true)).toBe(false);
  });
  it.each([{ status: "authorized" }, { amount: 1 }, { currency: "USD" }, { order_id: "other" }])("rejects invalid provider confirmation %j", async patch => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "pay_a", order_id: "order_a", amount: 10000, currency: "INR", status: "captured", ...patch })));
    expect(await capturedPayment("pay_a", "order_a", 100)).toBeNull();
  });
});
describe("uploaded content and worker access", () => {
  it("rejects executable content and decodes valid images", async () => {
    await expect(safeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).rejects.toMatchObject({ status: 415 });
    await expect(safeImage(Buffer.from("not an image"))).rejects.toMatchObject({ status: 415 });
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    expect((await sharp(await safeImage(png)).metadata()).format).toBe("jpeg");
  });
  it("requires scheduler authentication and rejects arbitrary push URLs", () => {
    const secret = "a".repeat(32);
    expect(workerAuthorized(request("{}"), secret)).toBe(false);
    expect(workerAuthorized(request("{}", { authorization: `Bearer ${secret}` }), secret)).toBe(true);
    for (const url of ["http://127.0.0.1/", "https://fcm.googleapis.com.evil.test/", "https://user@fcm.googleapis.com/"]) expect(trustedPushEndpoint(url)).toBe(false);
    expect(trustedPushEndpoint("https://fcm.googleapis.com/send/abc")).toBe(true);
  });
});
