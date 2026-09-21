-- =====================================================================
-- Migration 0054: Recipes / meal planner (shop-the-recipe)
--
-- Recipes tagged by cuisine (Indian state or international) + Diet/Traditional,
-- made of ingredients mapped to real products with a quantity for the base
-- servings. Customer picks servings + budget, browses by cuisine, and adds every
-- ingredient to the basket scaled to their servings. Applied live to project
-- bjevoybwufubtprkxbvb.
--   * recipes, recipe_items (RLS staff read; public reads via functions).
--   * get_recipe_cuisines / get_recipes(cuisine,diet,servings,budget) /
--     get_recipe(id,servings) — customer (anon + authenticated).
--   * get_admin_recipes / create_recipe / add_recipe_item — staff.
-- =====================================================================
revoke all on function public.get_recipe_cuisines() from public;
grant execute on function public.get_recipe_cuisines() to anon, authenticated;
revoke all on function public.get_recipes(text,text,int,numeric) from public;
grant execute on function public.get_recipes(text,text,int,numeric) to anon, authenticated;
revoke all on function public.get_recipe(uuid,int) from public;
grant execute on function public.get_recipe(uuid,int) to anon, authenticated;
revoke all on function public.get_admin_recipes() from public, anon;
grant execute on function public.get_admin_recipes() to authenticated;
revoke all on function public.create_recipe(text,text,boolean,int,text) from public, anon;
grant execute on function public.create_recipe(text,text,boolean,int,text) to authenticated;
revoke all on function public.add_recipe_item(uuid,uuid,numeric) from public, anon;
grant execute on function public.add_recipe_item(uuid,uuid,numeric) to authenticated;
