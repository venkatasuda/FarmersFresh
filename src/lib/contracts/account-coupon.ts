
export type MyCoupon = {
  code: string;
  kind: string;
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  expiresAt: string | null;
};
