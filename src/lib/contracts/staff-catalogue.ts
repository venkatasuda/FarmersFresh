
export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type ProductInput = {
  id: string | null;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  salePrice: number | null;
  compareAtPrice: number | null;
  description: string;
  packSize: number | null;
  packUnit: string | null;
  badge: string;
  imagePath: string | null;
  isPublished: boolean;
  dietTags: string[];
  sortOrder: number;
};
