
export type OverviewLine = { name: string; qty: number; revenue: number };

export type StockLine = { name: string; onHand: number; unit: string };

export type Overview = {
  revenueToday: number;
  ordersToday: number;
  openOrders: number;
  revenueWeek: number;
  topProducts: OverviewLine[];
  lowStock: StockLine[];
  pointsOutstanding: number;
  loyaltyMembers: number;
  activeSubscriptions: number;
  totalCustomers: number;
  repeatCustomers: number;
};
