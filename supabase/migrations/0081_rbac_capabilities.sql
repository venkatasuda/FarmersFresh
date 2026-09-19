-- =====================================================================
-- Migration 0081: DB-level RBAC. A capability matrix enforced inside admin
-- SECURITY DEFINER functions, so hiding a page in React is no longer the only
-- thing stopping a staff member or customer from calling an admin RPC directly.
-- Roles come from memberships.role; owner is a superuser via is_org_owner().
-- Applied live to bjevoybwufubtprkxbvb.
-- =====================================================================
create table if not exists public.role_capabilities (
  role       text not null,
  capability text not null,
  primary key (role, capability)
);
alter table public.role_capabilities enable row level security;
drop policy if exists role_capabilities_read on public.role_capabilities;
create policy role_capabilities_read on public.role_capabilities
  for select to authenticated using (true);

insert into public.role_capabilities (role, capability) values
  ('manager','catalogue.write'),
  ('manager','inventory.adjust'),
  ('manager','orders.manage'),
  ('manager','procurement.manage'),
  ('manager','delivery.assign'),
  ('manager','coupons.manage'),
  ('accountant','financials.read'),
  ('staff','orders.manage'),
  ('staff','delivery.assign')
on conflict do nothing;

create or replace function public.has_permission(p_capability text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_owner()
      or exists (
        select 1 from public.memberships m
        join public.role_capabilities rc on rc.role = m.role
        where m.user_id = auth.uid() and m.org_id = public.current_org_id()
          and rc.capability = p_capability
      );
$$;
revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;
