/**
 * Shared shapes and pure lookup tables, safe to import from anywhere —
 * Server Components, Client Components, Server Actions.
 *
 * Like `lib/format.ts`, this file must never import from `lib/supabase/*`.
 * See the comment at the top of `lib/format.ts` for why.
 */

// ---------- Catalogue ----------

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unit: "kg" | "piece";
  salePrice: number;
  imagePath: string | null;
  category: string | null;
  minOrderQty: number;
  stepQty: number;
  /**
   * A boolean, not a quantity — `catalogue_stock()` deliberately exposes only
   * whether something is buyable. Customers don't need to know you have 4.5 kg
   * left, and competitors definitely don't.
   */
  inStock: boolean;
  /** Struck-through "was" price. Always higher than salePrice — enforced by
   *  a database constraint, because a fake discount is a legal problem. */
  compareAtPrice: number | null;
  badge: string | null;
  categorySlug: string | null;
  brand: string | null;
  brandSlug: string | null;
  brandTagline: string | null;
  /**
   * Pack size, or null when the item is sold LOOSE BY WEIGHT.
   *
   * This is the fork that runs through the whole storefront: meat is cut to
   * order (1.5 kg of leg, stepping 500 g), groceries come in packs (one 5 kg
   * bag of atta). Asking for "0.5" of a turmeric packet is nonsense, so the
   * quantity stepper switches behaviour on this field.
   */
  packSize: number | null;
  packUnit: "g" | "kg" | "ml" | "l" | "piece" | "dozen" | null;
};

/** True when the item is cut/weighed to order rather than sold in packs. */
export function isLoose(p: { packSize: number | null }): boolean {
  return p.packSize === null;
}

/** "5 kg", "500 g", "1 L" — how the pack is labelled on the shelf. */
export function packLabel(p: {
  packSize: number | null;
  packUnit: string | null;
}): string | null {
  if (p.packSize === null || !p.packUnit) return null;
  const n = Number.isInteger(p.packSize) ? p.packSize : p.packSize;
  const unit = p.packUnit === "l" ? "L" : p.packUnit;
  if (p.packUnit === "piece") return `${n} pc`;
  if (p.packUnit === "dozen") return `${n} dozen`;
  return `${n} ${unit}`;
}

/**
 * Comparable price — "₹230/kg" — so a 500 g pack can be judged against a 1 kg
 * one. Returns null when there's nothing meaningful to compare.
 */
export function unitPrice(p: {
  salePrice: number;
  packSize: number | null;
  packUnit: string | null;
}): { value: number; per: string } | null {
  if (p.packSize === null || !p.packUnit || p.packSize <= 0) return null;
  switch (p.packUnit) {
    case "g":
      return { value: p.salePrice / (p.packSize / 1000), per: "kg" };
    case "kg":
      return { value: p.salePrice / p.packSize, per: "kg" };
    case "ml":
      return { value: p.salePrice / (p.packSize / 1000), per: "L" };
    case "l":
      return { value: p.salePrice / p.packSize, per: "L" };
    case "dozen":
      return { value: p.salePrice / (p.packSize * 12), per: "piece" };
    default:
      return null;
  }
}

export type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  icon: string | null;
  productCount: number;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  isPrimary: boolean;
};

/** The staff view of a product — includes unpublished and retired ones. */
export type AdminProduct = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  unit: "kg" | "piece";
  salePrice: number | null;
  compareAtPrice: number | null;
  packSize: number | null;
  packUnit: PackUnit | null;
  badge: string | null;
  imagePath: string | null;
  categoryId: string | null;
  brandId: string | null;
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
  onHand: number;
};

/** The pack units a product can actually have (never null — that's "loose"). */
export type PackUnit = "g" | "kg" | "ml" | "l" | "piece" | "dozen";

export type CustomerBalance = {
  customerId: string;
  name: string;
  phone: string | null;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
};

export type LedgerEntry = {
  id: string;
  kind: "charge" | "payment";
  amount: number;
  method: string | null;
  at: string;
};

/** A product as the counter till sees it. */
export type PosProduct = {
  id: string;
  name: string;
  unit: "kg" | "piece";
  salePrice: number;
  packSize: number | null;
  packUnit: PackUnit | null;
  category: string | null;
  onHand: number;
};

export const PACK_UNITS: { value: PackUnit; label: string }[] = [
  { value: "g", label: "grams (g)" },
  { value: "kg", label: "kilograms (kg)" },
  { value: "ml", label: "millilitres (ml)" },
  { value: "l", label: "litres (L)" },
  { value: "piece", label: "pieces" },
  { value: "dozen", label: "dozen" },
];

/**
 * Farmers Fresh sells its own brand — everything is either the master brand
 * or one of its sub-brands. So the storefront does NOT need a brand filter,
 * a brand logo strip, or "shop by brand": those exist to help a customer
 * choose between rival makers, and here there is only one maker.
 *
 * What the brand IS for is the promise attached to it — "milled and packed by
 * us", "ground in small batches". That's copy on a product page, not a facet.
 */
export function isHouseBrandOnly(brands: Brand[]): boolean {
  return brands.length > 0;
}

/** Departments (with stock) and their children, ready for a two-level menu. */
export function buildCategoryTree(
  all: Category[]
): { department: Category; children: Category[] }[] {
  return all
    .filter((c) => c.parentId === null && c.productCount > 0)
    .map((department) => ({
      department,
      children: all.filter(
        (c) => c.parentId === department.id && c.productCount > 0
      ),
    }));
}

/** Whole percent off, or null when there's no genuine discount. */
export function discountPercent(p: {
  salePrice: number;
  compareAtPrice: number | null;
}): number | null {
  if (!p.compareAtPrice || p.compareAtPrice <= p.salePrice) return null;
  return Math.round(((p.compareAtPrice - p.salePrice) / p.compareAtPrice) * 100);
}

// ---------- Orders ----------

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  id: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type StaffOrder = {
  id: string;
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  deliverySlot: string | null;
  notes: string | null;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  placedAt: string;
  items: OrderItem[];
};

export const SLOT_LABELS: Record<string, string> = {
  today_evening: "Today, 4–8 pm",
  tomorrow_morning: "Tomorrow, 7–11 am",
  tomorrow_evening: "Tomorrow, 4–8 pm",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The next step in the fulfilment chain, or null if there isn't one. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const chain: OrderStatus[] = [
    "placed",
    "confirmed",
    "packed",
    "out_for_delivery",
    "delivered",
  ];
  const i = chain.indexOf(status);
  return i >= 0 && i < chain.length - 1 ? chain[i + 1] : null;
}

// ---------- Stock ----------

export type StockLine = {
  productId: string;
  name: string;
  unit: "kg" | "piece";
  isPublished: boolean;
  onHand: number;
  locationId: string | null;
};

export type StockMovement = {
  id: string;
  productName: string;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

/** Reasons a human may record by hand. `sale`, `order_reserved` and
 *  `order_released` are written by the system and must not be pickable. */
export const STOCK_REASONS: { value: string; label: string; sign: 1 | -1 }[] = [
  { value: "production", label: "Cut today", sign: 1 },
  { value: "purchase", label: "Bought in", sign: 1 },
  { value: "transfer_in", label: "From another location", sign: 1 },
  { value: "waste", label: "Wasted / spoiled", sign: -1 },
  { value: "transfer_out", label: "Sent elsewhere", sign: -1 },
  { value: "stock_count", label: "Correction after count", sign: 1 },
];

export const STOCK_REASON_LABELS: Record<string, string> = {
  production: "Cut today",
  purchase: "Bought in",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  waste: "Wasted",
  stock_count: "Count correction",
  adjustment: "Adjustment",
  sale: "Counter sale",
  order_reserved: "Reserved for order",
  order_released: "Order cancelled",
};

/** Below this many kg, warn staff on the dashboard. */
export const LOW_STOCK_KG = 3;

// ---------- Delivery ----------

export const FREE_DELIVERY_OVER = 500;
export const DELIVERY_FEE = 40;

/**
 * Indicative only. `place_order` recalculates this server-side, so a tampered
 * page can change what the customer SEES but not what they are CHARGED.
 */
export function deliveryFeeFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
}
