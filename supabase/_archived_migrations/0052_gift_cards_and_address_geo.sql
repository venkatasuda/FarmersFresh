-- =====================================================================
-- Migration 0052: Gift cards + map-pin address coordinates
--
-- Applied live to project bjevoybwufubtprkxbvb.
--   * gift_cards table (RLS on; access only via RPCs).
--   * issue_gift_card(value) — staff; returns a code.
--   * redeem_gift_card(code) — customer; credits the value as loyalty points,
--     one redemption per card.
--   * customer_addresses gains lat/lng (captured via "use my location").
-- =====================================================================
revoke all on function public.issue_gift_card(numeric) from public, anon;
grant execute on function public.issue_gift_card(numeric) to authenticated;
revoke all on function public.redeem_gift_card(text) from public, anon;
grant execute on function public.redeem_gift_card(text) to authenticated;

alter table public.customer_addresses
  add column if not exists lat double precision,
  add column if not exists lng double precision;
