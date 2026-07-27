-- =====================================================================
-- Migration 0053: Add-items-after-order + order location pin
--
-- Applied live to project bjevoybwufubtprkxbvb.
--   * orders gains address_lat / address_lng (the customer's dropped pin).
--   * attach_order_location(order, lat, lng) — set the pin once, within 30 min
--     (anon + authenticated; the order id is only known to the placer).
--   * add_to_order(number, lines) — a logged-in customer adds items to their own
--     COD order within 15 min / before packing; reserves stock, recomputes the
--     total (keeping the existing discount & delivery fee).
--   * Rider "Navigate" uses the pin (lat,lng) when present.
-- =====================================================================
revoke all on function public.attach_order_location(uuid,double precision,double precision) from public;
grant execute on function public.attach_order_location(uuid,double precision,double precision) to anon, authenticated;
revoke all on function public.add_to_order(text,cart_line[]) from public, anon;
grant execute on function public.add_to_order(text,cart_line[]) to authenticated;
