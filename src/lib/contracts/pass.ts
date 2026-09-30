
export type Plan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  discountPercent: number;
};

export type Membership = {
  active: boolean;
  expiresAt: string;
  plan: string;
  discountPercent: number;
} | null;
