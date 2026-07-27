-- =====================================================================
-- Migration 0046: Smart refill reminders + personalised feed
--
--  * refill_suggestions() — products the logged-in customer buys on a rhythm
--    and is now about due to run out of (based on their own repurchase gap).
--  * personalized_products(limit) — products ranked by the categories the
--    customer actually buys from. Both per-user; empty for guests.
--
-- Applied live to project bjevoybwufubtprkxbvb; bodies via pg_get_functiondef.
-- =====================================================================
revoke all on function public.refill_suggestions() from public, anon;
grant execute on function public.refill_suggestions() to authenticated;
revoke all on function public.personalized_products(int) from public, anon;
grant execute on function public.personalized_products(int) to authenticated;
