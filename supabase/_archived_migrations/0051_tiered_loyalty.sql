-- =====================================================================
-- Migration 0051: Tiered loyalty (Silver / Gold / Platinum)
--
-- Tier from lifetime delivered spend boosts the points earn rate:
-- Silver 1x, Gold 1.5x (₹5,000+), Platinum 2x (₹20,000+). Reuses the points
-- ledger. Applied live to project bjevoybwufubtprkxbvb.
--   * my_tier() — tier, spend, multiplier, progress to next.
--   * reward_on_delivery() applies the multiplier to earned points.
-- =====================================================================
revoke all on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;
revoke all on function public.reward_on_delivery() from public, anon, authenticated;
