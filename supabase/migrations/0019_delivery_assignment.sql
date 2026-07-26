-- =====================================================================
-- Farmers Fresh — Migration 0019: Delivery assignment (rider screen)
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- An order can be claimed for delivery by a staff member. Light by design: a
-- rider is just a staff member who takes an order — no separate table.
-- `assigned_to` records who's carrying it so two people don't drive to the
-- same address, and so a rider's screen shows only their runs.
-- =====================================================================

alter table public.orders
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz;

create index if not exists idx_orders_assigned on public.orders(assigned_to)
  where assigned_to is not null;

create or replace function public.claim_delivery(p_order_id uuid, p_take boolean default true)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;

  update public.orders o
     set assigned_to = case when p_take then auth.uid() else null end,
         assigned_at = case when p_take then now() else null end
   where o.id = p_order_id and o.org_id = v_org
     and o.status not in ('delivered','cancelled');

  if not found then raise exception 'That order can no longer be claimed.'; end if;

  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), case when p_take then 'delivery.claimed' else 'delivery.released' end,
          'order', p_order_id, '{}'::jsonb);
end $$;

revoke all on function public.claim_delivery(uuid,boolean) from public, anon;
grant execute on function public.claim_delivery(uuid,boolean) to authenticated;
