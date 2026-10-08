export type CashSummary = {
  cod: number;
  pos: number;
  expected: number;
  outstanding_count: number;
  outstanding: { id: string; order_number: string; total: number; delivered_at: string | null }[];
  closing: { expected: number; counted: number; difference: number; note: string | null; closed_at: string } | null;
};
