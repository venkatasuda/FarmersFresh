-- =====================================================================
-- Migration 0048: Personalised coupons
--
-- A coupon can be tied to one customer (coupons.user_id). Only that customer
-- can redeem it (preview_coupon enforces ownership) and it appears in their
-- account. Staff grant one by phone.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * coupons.user_id (nullable).
--   * preview_coupon() recreated with the ownership check.
--   * my_coupons() — the caller's personal codes (account page).
--   * grant_personal_coupon(phone, kind, value, min, days, max) — staff.
-- =====================================================================
alter table public.coupons
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

revoke all on function public.my_coupons() from public, anon;
grant execute on function public.my_coupons() to authenticated;
revoke all on function public.grant_personal_coupon(text,text,numeric,numeric,int,numeric) from public, anon;
grant execute on function public.grant_personal_coupon(text,text,numeric,numeric,int,numeric) to authenticated;
