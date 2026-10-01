
export type SalesSummary = {
  todaySales: number;
  todayCount: number;
  weekSales: number;
  todayCollected: number;
  outstanding: number;
  openOrders: number;
  methodSplit: { method: string; amount: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { name: string; qty: number }[];
};

export type DemandInsights = {
  byWeekday: { day: string; revenue: number }[];
  reorder: { name: string; onHand: number; perDay: number; daysLeft: number | null }[];
  thisWeek: number;
  lastWeek: number;
};
