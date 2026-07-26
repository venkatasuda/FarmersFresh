-- =====================================================================
-- Migration 0041: Farmers Fresh Pass (paid membership) — part 1
--
-- Adds membership_plans (+ a seeded default plan) and the Pass functions.
-- NOTE: this migration originally created a `memberships` table, but that name
-- was already taken by the staff<->location table, so the customer-pass table
-- and the corrected function/place_order bodies live in 0042. Applied live to
-- project bjevoybwufubtprkxbvb.
-- =====================================================================

create table if not exists public.membership_plans (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  price            numeric(12,2) not null,
  duration_days    int not null,
  discount_percent numeric(5,2) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
alter table public.membership_plans enable row level security;
drop policy if exists plans_public_read on public.membership_plans;
create policy plans_public_read on public.membership_plans for select using (is_active = true);

insert into public.membership_plans (org_id, name, price, duration_days, discount_percent)
select public.storefront_org_id(), 'Farmers Fresh Pass — 3 months', 199, 90, 5
where public.storefront_org_id() is not null
  and not exists (select 1 from public.membership_plans where org_id = public.storefront_org_id());

revoke all on function public.get_membership_plans() from public;
grant execute on function public.get_membership_plans() to anon, authenticated;
