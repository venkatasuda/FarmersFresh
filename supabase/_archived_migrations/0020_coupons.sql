-- =====================================================================
-- Farmers Fresh — Migration 0020: Coupons / promo codes
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Percent-off (with optional cap) or flat-amount coupons. All guardrails —
-- expiry, usage limit, per-phone limit, minimum spend — are enforced in the
-- database, because a discount is money and must never be trusted from the
-- browser. preview_coupon() lets anon check a code without reading the table;
-- place_order() (migration 0020b) re-validates and applies the discount from
-- the server's own subtotal, then records code + discount on the order.
--
-- Verified: 20% capped at 300 gives 1700 -> 1400; reuse blocked by per-phone
-- limit; below-minimum blocked.
-- =====================================================================

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  code          text not null,
  kind          text not null check (kind in ('percent','flat')),
  value         numeric(12,2) not null check (value > 0),
  max_discount  numeric(12,2),
  min_subtotal  numeric(12,2) not null default 0,
  usage_limit   integer,
  used_count    integer not null default 0,
  per_phone_limit integer not null default 1,
  starts_at     timestamptz,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);
create index if not exists idx_coupons_code on public.coupons(org_id, upper(code)) where is_active;

alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount numeric(12,2) not null default 0 check (discount >= 0);

alter table public.coupons enable row level security;

drop policy if exists coupon_owner_all on public.coupons;
create policy coupon_owner_all on public.coupons for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- preview_coupon(org, code, subtotal, phone) → jsonb {ok, discount, message}.
-- Full body applied live; reproduce with:
--   select pg_get_functiondef('public.preview_coupon'::regproc);
revoke all on function public.preview_coupon(uuid,text,numeric,text) from public;
grant execute on function public.preview_coupon(uuid,text,numeric,text) to anon, authenticated;

-- place_order was re-created with p_coupon_code (last param). See the live
-- definition or migration 0017's companion for the preserved zone/rate/stock
-- logic it builds on.
