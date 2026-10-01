
export type RecipeCard = {
  id: string;
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  imagePath: string | null;
  cost: number;
  ingredientCount: number;
};

export type RecipeIngredient = {
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

export type RecipeDetail = {
  id: string;
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  description: string | null;
  imagePath: string | null;
  videoUrl: string | null;
  items: RecipeIngredient[];
};
