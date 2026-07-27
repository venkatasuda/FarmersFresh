-- =====================================================================
-- Migration 0050: Margin guardrail on discounts
--
-- Promotional discount (coupon + Pass member %) can never exceed
-- organizations.max_discount_percent of the subtotal, so an order can't be sold
-- at a loss no matter how a coupon is configured. Loyalty points (the
-- customer's own earned balance) are NOT part of this cap. Owner-tunable under
-- Settings; defaults to 50%.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * organizations.max_discount_percent (default 50).
--   * get_store_admin_settings / update_store_settings include the cap
--     (update_store_settings gains a 10th param — old 9-arg form dropped).
--   * place_order() recreated to clamp the promo discount at the cap.
-- =====================================================================

alter table public.organizations
  add column if not exists max_discount_percent numeric(5,2) not null default 50;

revoke all on function public.get_store_admin_settings() from public, anon;
grant execute on function public.get_store_admin_settings() to authenticated;

revoke all on function public.update_store_settings(text,text,text,text,text,numeric,numeric,text,text,numeric) from public, anon;
grant execute on function public.update_store_settings(text,text,text,text,text,numeric,numeric,text,text,numeric) to authenticated;

revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) to anon, authenticated;
