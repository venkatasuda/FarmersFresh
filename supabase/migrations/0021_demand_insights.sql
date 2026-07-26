-- =====================================================================
-- Farmers Fresh — Migration 0021: Demand insights
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Owner-only function turning sales + the stock ledger into decisions:
--   * revenue by day of week (which days are busy)
--   * reorder guidance — units sold per day over 14 days vs on hand, as
--     "days of stock left" (the money question for perishables)
--   * this-week vs last-week momentum
--
-- Honest statistics on the shop's own data. The immutable event log remains
-- the future feed for genuine ML; this delivers value today without it.
-- All computed in the database over the last 30 days. See live definition:
--   select pg_get_functiondef('public.demand_insights'::regproc);
-- =====================================================================

revoke all on function public.demand_insights() from public, anon;
grant execute on function public.demand_insights() to authenticated;
