-- =====================================================================
-- Migration 0057: Tip the rider (points) + instant wallet refund
--
-- Applied live to project bjevoybwufubtprkxbvb.
--   * orders.tip_points.
--   * tip_delivery(number, points) — customer tips their rider from loyalty
--     points after delivery; recorded on the order.
--   * instant_refund(order, points, reason) — staff credit points to a
--     customer's balance immediately (no returns request).
-- =====================================================================
revoke all on function public.tip_delivery(text,int) from public, anon;
grant execute on function public.tip_delivery(text,int) to authenticated;
revoke all on function public.instant_refund(uuid,numeric,text) from public, anon;
grant execute on function public.instant_refund(uuid,numeric,text) to authenticated;
