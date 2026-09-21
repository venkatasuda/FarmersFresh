-- =====================================================================
-- Migration 0055: set_recipe_image — staff attach a photo to a recipe
-- (uploaded to the product-images bucket from the browser). Applied live.
-- =====================================================================
revoke all on function public.set_recipe_image(uuid,text) from public, anon;
grant execute on function public.set_recipe_image(uuid,text) to authenticated;
