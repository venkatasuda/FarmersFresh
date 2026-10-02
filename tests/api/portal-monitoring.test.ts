import { afterEach, expect, it, vi } from "vitest";
import { monitoringMetrics } from "@/lib/contracts/monitoring";
import { getPortalMonitoring } from "@/server/operations/monitoring";
const mock = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), query: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireSession: mock.session }));
vi.mock("@/server/supabase/server", () => ({ createClient: () => ({ rpc: mock.rpc }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
afterEach(() => vi.clearAllMocks());
it("blocks regular staff before querying monitoring data", async () => {
  mock.session.mockResolvedValue({ isOwner: false, memberships: [{ role: "staff", locationType: "store" }] });
  await expect(getPortalMonitoring()).rejects.toThrow("NOT_FOUND");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("uses the signed-in RPC and fails safely on invalid or unavailable counts", async () => {
  mock.session.mockResolvedValue({ isOwner: false, memberships: [{ role: "manager", locationType: "store", locationName: "Demo store" }] });
  mock.rpc.mockReturnValue({ abortSignal: mock.query });
  const data = monitoringMetrics.map(metric => ({ metric, value: "1" }));
  mock.query.mockResolvedValue({ data, error: null });
  expect((await getPortalMonitoring()).counts?.ff_stuck_orders).toBe(1);
  expect(mock.rpc).toHaveBeenCalledWith("portal_operations_metrics");
  for (const response of [{ data: [], error: null }, { data: data.map(row => ({ ...row, value: "-1" })), error: null }, { data: null, error: { message: "private database error" } }]) {
    mock.query.mockResolvedValue(response);
    expect((await getPortalMonitoring()).counts).toBeNull();
  }
  mock.query.mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(getPortalMonitoring()).rejects.toThrow("NOT_FOUND");
});
