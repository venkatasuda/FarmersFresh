-- =====================================================================
-- Migration 0061: bestseller_ids — top-selling products (last 30 days, online +
-- counter) for the "Bestseller" badge on product cards. Public, read-only.
-- Applied live to project bjevoybwufubtprkxbvb.
-- =====================================================================
revoke all on function public.bestseller_ids(int) from public;
grant execute on function public.bestseller_ids(int) to anon, authenticated;
