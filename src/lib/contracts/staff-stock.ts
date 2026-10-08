
export type StockResult = { ok: true } | { ok: false; message: string };
export type StockTransfer = {
  id: string; sourceId: string; destinationId: string; source: string; destination: string;
  product: string; unit: "kg" | "piece"; quantity: number;
  status: "dispatched" | "received"; createdAt: string;
};
