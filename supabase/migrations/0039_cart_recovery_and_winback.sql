-- =====================================================================
-- Migration 0039: Abandoned-cart recovery + win-back
--
--  * saved_carts — a logged-in customer's latest basket summary (count +
--    subtotal), upserted as they shop. remind_abandoned_carts() (cron every
--    30 min) nudges a cart left 3h+ untouched, unless they've since ordered.
--    save_cart / clear_cart manage it; RLS scopes rows to the owner.
--  * winback_log + run_winback() (cron weekly) — customers whose last order was
--    30+ days ago get one nudge a month, across email/SMS/WhatsApp/push.
--
-- Applied live to project bjevoybwufubtprkxbvb; bodies via pg_get_functiondef.
-- =====================================================================

revoke all on function public.save_cart(int,numeric) from public, anon;
grant execute on function public.save_cart(int,numeric) to authenticated;
revoke all on function public.clear_cart() from public, anon;
grant execute on function public.clear_cart() to authenticated;
revoke all on function public.remind_abandoned_carts() from public, anon, authenticated;
revoke all on function public.run_winback(int) from public, anon, authenticated;
