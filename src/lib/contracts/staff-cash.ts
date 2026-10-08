export type CashSummary = {
  cod: number;
  pos: number;
  refunds: number;
  refund_requests: { id: string; order_number: string; collected: number }[];
  expected: number;
  outstanding_count: number;
  outstanding: { id: string; order_number: string; total: number; delivered_at: string | null }[];
  closing: { expected: number; counted: number; difference: number; note: string | null; closed_at: string } | null;
};
export type CashShift = { id: string; opening: number; opened_at: string; closed_at: string | null; expected: number; counted: number | null; difference: number | null; note: string | null };
export type CashShifts = { active: (CashShift & { receipts: number; refunds: number }) | null; recent: CashShift[] };
