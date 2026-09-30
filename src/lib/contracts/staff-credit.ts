
export type PaymentResult =
  | { ok: true; outstanding: number }
  | { ok: false; message: string };
