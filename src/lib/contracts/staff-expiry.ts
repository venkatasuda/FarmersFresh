
export type ExpiringBatch = {
  id: string;
  productId: string;
  productName: string;
  batchCode: string;
  remaining: number;
  expiryDate: string | null;
  daysLeft: number | null;
  value: number;
  salePrice: number;
  lastCost: number | null;
  markedDown: boolean;
};
