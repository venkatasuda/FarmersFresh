
export type PaymentMethod = "cod" | "upi" | "card";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      paymentMethod: PaymentMethod;
    }
  | { ok: false; message: string };

export type SubmittedLine = { productId: string; quantity: number };

export type SavedAddress = {
  id: string;
  label: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  isDefault: boolean;
};

export type CheckoutPrefill = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  landmark: string;
};
