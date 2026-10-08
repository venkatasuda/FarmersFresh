import { afterEach, expect, it, vi } from "vitest";
import { collectCod, closeCashDay, isBusinessDate } from "@/server/reporting/staff-cash";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/server/supabase/server", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const id = "11111111-1111-4111-8111-111111111111";
it("validates cash amounts and calendar dates before reaching the database", async () => {
  for (const amount of [NaN, Infinity, -1, 0, 1.001, 10_000_001]) expect(await collectCod(id, amount)).toMatchObject({ ok: false });
  expect(isBusinessDate("2026-02-30")).toBe(false);
  expect(isBusinessDate("2024-02-29")).toBe(true);
  expect(await closeCashDay(id, "2026-02-30", 0, 0, "")).toMatchObject({ ok: false });
  expect(await closeCashDay(id, "2026-10-07", 0, -1, "")).toMatchObject({ ok: false });
  expect(await closeCashDay(id, "2026-10-07", 0, null as unknown as number, "")).toMatchObject({ ok: false });
  expect(rpc).not.toHaveBeenCalled();
});
it("sanitizes failed saves and accepts a zero-count completed day", async () => {
  rpc.mockResolvedValue({ error: { message: "private SQL relation details" } });
  expect(await collectCod(id, 100)).toEqual({ ok: false, message: "Something went wrong. Please try again." });
  rpc.mockResolvedValue({ error: null });
  expect(await closeCashDay(id, "2026-10-07", 0, 0, "")).toEqual({ ok: true });
});
