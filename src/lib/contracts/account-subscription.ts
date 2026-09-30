
export type MySubscription = {
  id: string;
  product_id: string;
  product_name: string;
  image_path: string | null;
  quantity: number;
  frequency: "daily" | "weekly" | "monthly";
  is_active: boolean;
  next_run: string | null;
};

export type SubActionResult = { ok: boolean };
