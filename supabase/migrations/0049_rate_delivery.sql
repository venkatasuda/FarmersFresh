-- =====================================================================
-- Migration 0049: Rate the delivery
--
-- After a delivered order, the customer leaves a 1–5 star rating + optional
-- comment (one per order). Access mirrors track/receipt: owner-by-login, or
-- order number + matching phone.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * orders gains delivery_rating, delivery_comment, rated_at.
--   * rate_delivery(number, phone, rating, comment) — anon + authenticated.
-- =====================================================================
revoke all on function public.rate_delivery(text,text,int,text) from public;
grant execute on function public.rate_delivery(text,text,int,text) to anon, authenticated;
