
export type TrackedItem = {
  name: string;
  quantity: number;
  unit: string;
  lineTotal: number;
  slug: string | null;
};

export type TrackedOrder = {
  deliveryFailed: boolean;
  orderNumber: string;
  status:
    | "placed"
    | "confirmed"
    | "packed"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "refund_pending";
  total: number;
  subtotal: number;
  deliveryFee: number;
  placedAt: string;
  deliverySlot: string | null;
  contactName: string;
  cancelledReason: string | null;
  items: TrackedItem[];
  tracking: {
    lat: number;
    lng: number;
    updatedAt: string;
    etaMinutes: number | null;
    etaSetAt: string | null;
  } | null;
};

export type TrackResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; message: string };
