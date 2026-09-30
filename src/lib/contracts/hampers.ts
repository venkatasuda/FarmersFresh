
export type HamperCard = {
  id: string;
  name: string;
  imagePath: string | null;
  cost: number;
  itemCount: number;
};

export type HamperItem = {
  productId: string;
  slug: string;
  name: string;
  unit: "kg" | "piece";
  price: number;
  imagePath: string | null;
  packSize: number | null;
  qty: number;
  lineCost: number;
};

export type HamperDetail = {
  id: string;
  name: string;
  description: string | null;
  items: HamperItem[];
};
