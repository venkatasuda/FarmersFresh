
export type WastageRow = {
  id: string;
  productName: string;
  quantity: number;
  reason: string;
  value: number;
  note: string | null;
  createdAt: string;
};

export type WastageSummary = {
  totalValue: number;
  totalEvents: number;
  byReason: { reason: string; value: number; events: number }[];
  byProduct: { productName: string; quantity: number; value: number }[];
};
