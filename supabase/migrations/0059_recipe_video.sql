-- =====================================================================
-- Migration 0059: Recipe cooking video (YouTube)
--
-- recipes.video_url — the shop's own YouTube cooking video, embedded on the
-- recipe (helps customers cook, drives views to your channel).
-- Applied live to project bjevoybwufubtprkxbvb.
--   * set_recipe_video(recipe, url) — staff.
--   * get_recipe() also returns video_url.
-- =====================================================================
revoke all on function public.set_recipe_video(uuid,text) from public, anon;
grant execute on function public.set_recipe_video(uuid,text) to authenticated;
revoke all on function public.get_recipe(uuid,int) from public;
grant execute on function public.get_recipe(uuid,int) to anon, authenticated;
