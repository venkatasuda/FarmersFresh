-- =====================================================================
-- Farmers Fresh — Migration 0004: Stock as a ledger, and order reservation
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- WHY A LEDGER RATHER THAN A QUANTITY COLUMN
-- A single `quantity` cell that gets updated is unauditable: when it is
-- wrong — and in a meat shop it will be — there is no way to learn why.
-- Every change here is an immutable row saying how much, why, and who.
-- On-hand is the SUM. This matches the `events` philosophy already in the
-- project, and it is what makes wastage measurable later.
--
-- `stock_items` from migration 0001 is left in place but is NO LONGER the
-- source of truth. Nothing writes to it. Treat it as deprecated.
-- =====================================================================

alter table public.organizations
  add column if not exists storefront_location_id uuid references public.locations(id);

create table if not exists public.stock_movements (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete restrict,
  product_id   uuid not null references public.products(id) on delete restrict,
  delta        numeric(12,3) not null check (delta <> 0),
  reason       text not null check (reason in (
                 'production','purchase','sale','order_reserved','order_released',
                 'waste','adjustment','stock_count','transfer_in','transfer_out')),
  ref_type     text,
  ref_id       uuid,
  actor_id     uuid references public.profiles(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_stockmov_lookup
  on public.stock_movements(org_id, location_id, product_id);
create index if not exists idx_stockmov_ref on public.stock_movements(ref_type, ref_id);
create index if not exists idx_stockmov_created on public.stock_movements(created_at);

-- Append-only, exactly like `events`. Corrections are made by adding an
-- opposing row, never by editing history.
drop trigger if exists trg_stockmov_no_update on public.stock_movements;
create trigger trg_stockmov_no_update
  before update or delete on public.stock_movements
  for each row execute function public.block_mutation();

create or replace view public.stock_on_hand
with (security_invoker = true) as
select m.org_id, m.location_id, m.product_id, p.name as product_name,
       sum(m.delta) as quantity
from public.stock_movements m
join public.products p on p.id = m.product_id
group by m.org_id, m.location_id, m.product_id, p.name;

create or replace function public.stock_available(p_location uuid, p_product uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)
  from public.stock_movements
  where location_id = p_location and product_id = p_product;
$$;
revoke all on function public.stock_available(uuid,uuid) from public, anon;
grant execute on function public.stock_available(uuid,uuid) to authenticated;

-- Staff: record a movement. Stock cannot be driven negative by hand — if it
-- wants to go below zero the count is wrong and a person should look.
create or replace function public.record_stock(
  p_location uuid, p_product uuid, p_delta numeric,
  p_reason text, p_note text default null
)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; v_id bigint; v_on_hand numeric;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that location.';
  end if;
  if p_reason not in ('production','purchase','waste','adjustment','stock_count',
                      'transfer_in','transfer_out') then
    raise exception 'Invalid reason for a manual movement.';
  end if;
  if p_delta = 0 then raise exception 'Movement cannot be zero.'; end if;

  v_on_hand := public.stock_available(p_location, p_product);
  if v_on_hand + p_delta < 0 then
    raise exception 'That would take stock below zero (on hand: % kg).', v_on_hand;
  end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, actor_id, note)
  values (v_org, p_location, p_product, p_delta, p_reason, auth.uid(), p_note)
  returning id into v_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, p_location, auth.uid(), 'stock.' || p_reason, 'product', p_product,
          jsonb_build_object('delta', p_delta, 'note', p_note));

  return v_id;
end $$;
revoke all on function public.record_stock(uuid,uuid,numeric,text,text) from public, anon;
grant execute on function public.record_stock(uuid,uuid,numeric,text,text) to authenticated;

-- Public availability: a BOOLEAN, not a quantity. Customers do not need to
-- know you have 4.5 kg left, and competitors certainly do not.
--
-- A FUNCTION rather than a view: a SECURITY DEFINER view hides the fact that
-- it bypasses RLS from anyone reading the calling code, and Supabase's linter
-- flags it as an error. A function makes the privilege escalation explicit.
create or replace function public.catalogue_stock()
returns table (product_id uuid, in_stock boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         (coalesce(soh.qty, 0) >= p.min_order_qty) as in_stock
  from public.products p
  join public.organizations o on o.id = p.org_id
  left join (
    select m.location_id, m.product_id, sum(m.delta) as qty
    from public.stock_movements m
    group by m.location_id, m.product_id
  ) soh on soh.product_id = p.id and soh.location_id = o.storefront_location_id
  where p.is_published and p.is_active and o.storefront_enabled;
$$;

revoke all on function public.catalogue_stock() from public;
grant execute on function public.catalogue_stock() to anon, authenticated;

alter table public.stock_movements enable row level security;

drop policy if exists stockmov_read on public.stock_movements;
create policy stockmov_read on public.stock_movements for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));

drop policy if exists stockmov_insert on public.stock_movements;
create policy stockmov_insert on public.stock_movements for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));

-- =====================================================================
-- Seed (run once, after setting storefront_location_id)
-- =====================================================================
-- update public.organizations o
--    set storefront_location_id = (
--      select l.id from public.locations l
--      where l.org_id = o.id and l.type = 'store' and l.is_active
--      order by l.created_at limit 1)
--  where o.storefront_enabled;
