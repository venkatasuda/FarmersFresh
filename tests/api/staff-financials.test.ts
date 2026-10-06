import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFinancials } from "@/server/reporting/staff-financials";
import { StaffNavigation } from "@/features/dashboard/navigation/staff-navigation";
import type { Session } from "@/lib/contracts/auth-session";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({ createClient: () => ({ rpc: mock.rpc }) }));
afterEach(() => vi.clearAllMocks());

function reports() {
  mock.rpc.mockImplementation(async (name: string) => ({ error: null, data:
    name === "has_permission" ? true : name === "financial_report_locations" ? ["store-id"] :
    name === "financials_overview" ? { revenue: 100, order_count: 1 } : [] }));
}

it("denies direct finance actions before querying reports and validates the reporting period", async () => {
  mock.rpc.mockResolvedValue({ data: false, error: null });
  await expect(getFinancials()).rejects.toThrow("Insufficient permission.");
  expect(mock.rpc.mock.calls.map(call => call[0])).toEqual(["has_permission"]);
  mock.rpc.mockClear();
  await expect(getFinancials(Number.NaN)).rejects.toThrow("supported reporting period");
  await expect(getFinancials(100000)).rejects.toThrow("supported reporting period");
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("fails closed before report queries when the scope migration is missing", async () => {
  mock.rpc.mockImplementation(async (name: string) => name === "has_permission"
    ? { data: true, error: null } : { data: null, error: { message: "function missing" } });
  await expect(getFinancials()).rejects.toThrow("temporarily unavailable");
  expect(mock.rpc.mock.calls.map(call => call[0])).toEqual(["has_permission", "financial_report_locations"]);
});

it("loads authorized finance and never converts database failures into zero revenue", async () => {
  reports();
  expect((await getFinancials(7)).overview.revenue).toBe(100);
  mock.rpc.mockImplementation(async (name: string) => ({ data:
    name === "has_permission" ? true : name === "financial_report_locations" ? ["store-id"] : null,
    error: name === "financials_overview" ? { message: "private database detail" } : null }));
  await expect(getFinancials()).rejects.toThrow("Financial reports are temporarily unavailable.");
});

it("shows finance-only staff their reports without counter or operations navigation", () => {
  const session = { isOwner: false, memberships: [{ role: "accountant", locationType: "store" }] } as Session;
  const markup = renderToStaticMarkup(createElement(StaffNavigation, { session, canReadFinancials: true, canManageOrders: false }));
  expect(markup).toContain('href="/dashboard/financials"');
  for (const route of ["pos", "orders", "stock", "deliveries", "returns", "credit", "settings"]) {
    expect(markup).not.toContain(`href="/dashboard/${route}"`);
  }
  const staff = renderToStaticMarkup(createElement(StaffNavigation, { session, canReadFinancials: false, canManageOrders: true }));
  expect(staff).not.toContain('href="/dashboard/financials"');
  expect(staff).toContain('href="/dashboard/orders"');
});
