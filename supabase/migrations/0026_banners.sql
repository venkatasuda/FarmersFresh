-- =====================================================================
-- Farmers Fresh — Migration 0026: Promo banners
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- The homepage carousel MNCs run. Owner-managed: title, subtitle, CTA, link,
-- and a colour gradient (no artwork needed, though image_path overrides it).
-- Public reads active + in-window banners via active_banners(); owner manages
-- the table under RLS. Full function body applied live.
-- =====================================================================

create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  subtitle    text,
  cta_label   text,
  href        text,
  bg_from     text not null default '#16a34a',
  bg_to       text not null default '#14532d',
  image_path  text,
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_banners_active on public.banners(org_id, sort_order) where is_active;

alter table public.banners enable row level security;

drop policy if exists banner_public_read on public.banners;
create policy banner_public_read on public.banners for select to anon, authenticated
  using (is_active and public.is_storefront_org(org_id));

drop policy if exists banner_owner on public.banners;
create policy banner_owner on public.banners for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

revoke all on function public.active_banners() from public;
grant execute on function public.active_banners() to anon, authenticated;
