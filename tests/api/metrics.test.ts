import { afterEach, expect, it, vi } from "vitest";
import { metrics } from "@/server/operations/metrics";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), query: vi.fn() }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mock.rpc }) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
function setup() {
  vi.stubEnv("MONITORING_TOKEN", "x".repeat(64));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ci-secret");
  mock.rpc.mockReturnValue({ abortSignal: mock.query });
}
it("fails closed before any privileged query for missing or wrong credentials", async () => {
  setup();
  expect((await metrics(new Request("https://example.test"))).status).toBe(401);
  vi.stubEnv("MONITORING_TOKEN", "short");
  expect((await metrics(new Request("https://example.test"))).status).toBe(503);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("exports only valid gauges and does not disclose database failures", async () => {
  setup();
  const request = new Request("https://example.test", { headers: { authorization: `Bearer ${"x".repeat(64)}` } });
  mock.query.mockResolvedValue({ data: [{ metric: "ff_pending_refunds", value: "2" }], error: null });
  const response = await metrics(request);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("# TYPE ff_pending_refunds gauge\nff_pending_refunds 2\n");
  for (const data of [[{ metric: "bad\nsecret", value: 1 }], [{ metric: "ff_bad", value: -1 }], null]) {
    mock.query.mockResolvedValue({ data, error: null });
    const failure = await metrics(request);
    expect(failure.status).toBe(503);
    expect(await failure.text()).toBe("Unavailable");
  }
  mock.query.mockResolvedValue({ data: null, error: { message: "private connection details" } });
  expect(await (await metrics(request)).text()).toBe("Unavailable");
});
