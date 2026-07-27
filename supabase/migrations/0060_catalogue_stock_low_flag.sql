-- =====================================================================
-- Migration 0060: catalogue_stock adds a "low" flag
--
-- Returns (product_id, in_stock, low) — 'low' = in stock but running down
-- (<= 3 kg for loose items, <= 5 for packs), powering the "only a few left"
-- urgency cue on product cards. Function dropped & recreated (return type
-- change); re-granted to anon + authenticated. Applied live to project
-- bjevoybwufubtprkxbvb.
-- =====================================================================
revoke all on function public.catalogue_stock() from public;
grant execute on function public.catalogue_stock() to anon, authenticated;
