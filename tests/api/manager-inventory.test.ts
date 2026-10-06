import { afterEach, expect, it, vi } from "vitest";
import { getStockLines, getRecentMovements } from "@/server/inventory/queries";
import { getOperationalLocations } from "@/server/auth/permissions";

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), eq: vi.fn(), stockError: null as object | null }));
vi.mock("@/server/supabase/server", () => ({ createClient: () => ({ from: mock.from, rpc: mock.rpc }) }));
afterEach(() => { vi.clearAllMocks(); mock.stockError = null; });

it("filters both stock totals and ledger entries to the selected store and fails safely on a failed stock read", async () => {
  mock.from.mockImplementation((table: string) => {
    const data = table === 'products' ? [{ id: 'product', name: 'Chicken', unit: 'kg', is_published: true }]
      : table === 'stock_on_hand' ? [{ product_id: 'product', location_id: 'store', quantity: 12 }] : [];
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { mock.eq(table, field, value); return query; },
      order: () => query, limit: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: table === 'stock_on_hand' ? mock.stockError : null }).then(resolve),
    };
    return query;
  });
  expect(await getStockLines('store')).toMatchObject([{ productId: 'product', onHand: 12 }]);
  await getRecentMovements(20, 'store');
  expect(mock.eq).toHaveBeenCalledWith('stock_on_hand', 'location_id', 'store');
  expect(mock.eq).toHaveBeenCalledWith('stock_movements', 'location_id', 'store');
  mock.stockError = { message: 'private database detail' };
  await expect(getStockLines('store')).rejects.toThrow('Stock is temporarily unavailable.');
});

it("uses database assignments and fails closed when the migration is unavailable", async () => {
  mock.rpc.mockResolvedValue({ data: [{ id: 'store', name: 'My store' }], error: null });
  expect(await getOperationalLocations('inventory.adjust')).toEqual([{ id: 'store', name: 'My store' }]);
  expect(mock.rpc).toHaveBeenCalledWith('operational_locations', { p_capability: 'inventory.adjust' });
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'private schema detail' } });
  await expect(getOperationalLocations('procurement.manage')).rejects.toThrow('Store access is temporarily unavailable.');
});
