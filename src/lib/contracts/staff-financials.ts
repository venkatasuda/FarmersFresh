
export type FinOverview = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  costedPct: number;
  orderCount: number;
};

export type MarginRow = {
  productName: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  salePrice: number;
  lastCost: number | null;
};

export type PaymentRow = {
  paymentMethod: string;
  orders: number;
  revenue: number;
};

export type PriceAlert = {
  productName: string;
  salePrice: number;
  lastCost: number | null;
  marginPct: number;
};

export type Financials = {
  overview: FinOverview;
  margins: MarginRow[];
  payments: PaymentRow[];
  alerts: PriceAlert[];
};
