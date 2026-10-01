
export type SaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type SaleResult =
  | { ok: true; saleId: string; total: number; change: number }
  | { ok: false; message: string };

export type LoyaltyMember =
  | { found: true; userId: string; name: string; points: number }
  | { found: false };
