
export type Wallet = { balance: number; code: string; referred: boolean };

export type Savings = {
  /** Real money off — coupon + Pass member discounts, in rupees. */
  totalDiscount: number;
  /** How many orders shipped with free delivery. */
  freeDeliveries: number;
  /** Non-cancelled orders counted. */
  orderCount: number;
};
