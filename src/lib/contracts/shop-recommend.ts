
export type MiniProduct = {
  id: string;
  slug: string;
  name: string;
  unit: "kg" | "piece";
  salePrice: number;
  imagePath: string | null;
  packLabel: string | null;
  step: number;
  minOrderQty: number;
};
