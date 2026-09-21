-- =====================================================================
-- Migration 0031: Recurring subscriptions
--
-- "Deliver this every day/week." A subscription snapshots the product, the
-- quantity and the delivery details; a daily job creates the order when it's
-- due and advances the schedule. Orders flow through the same stock ledger and
-- customer-notification trigger as any other, so a subscription order behaves
-- exactly like a normal one downstream.
-- =====================================================================

create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  quantity      numeric(12,3) not null check (quantity > 0),
  frequency     text not null check (frequency in ('daily','weekly','monthly')),
  next_run      date not null,
  contact_name  text not null,
  contact_phone text not null,
  address_line  text not null,
  city text, pincode text, landmark text,
  is_active     boolean not null default true,
  last_order_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_subs_due on public.subscriptions(next_run) where is_active;
create index if not exists idx_subs_user on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;
drop policy if exists sub_own on public.subscriptions;
create policy sub_own on public.subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create one order for a due subscription. Reserves stock; skips (without
-- failing) if the item is out of stock, so a shortage doesn't kill the
-- schedule. Advances next_run either way.
create or replace function public.run_one_subscription(p_sub uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  s record; v_loc uuid; v_price numeric(12,2); v_on_hand numeric;
  v_order uuid; v_number text; v_total numeric(12,2); v_fee numeric(12,2); v_step interval;
begin
  select * into s from public.subscriptions where id = p_sub and is_active;
  if s.id is null then return false; end if;

  select storefront_location_id into v_loc from public.organizations where id = s.org_id;
  select sale_price into v_price from public.products
   where id = s.product_id and org_id = s.org_id and is_published and is_active;

  v_step := case s.frequency when 'daily' then interval '1 day'
                             when 'weekly' then interval '7 days'
                             else interval '1 month' end;

  if v_loc is null or v_price is null then
    update public.subscriptions set next_run = (next_run + v_step)::date where id = p_sub;
    return false;
  end if;

  v_on_hand := public.stock_available(v_loc, s.product_id);
  if v_on_hand < s.quantity then
    -- Not enough stock today; try again next cycle.
    update public.subscriptions set next_run = (next_run + v_step)::date where id = p_sub;
    insert into public.events (org_id, event_type, entity_type, entity_id, payload)
    values (s.org_id, 'subscription.skipped', 'subscription', p_sub,
            jsonb_build_object('reason','out_of_stock'));
    return false;
  end if;

  v_number := public.next_order_number();
  v_total := round(v_price * s.quantity, 2);
  v_fee := case when v_total >= 500 then 0 else 40 end;

  insert into public.orders (
    org_id, location_id, order_number, contact_name, contact_phone,
    address_line, city, pincode, landmark, delivery_slot, notes, user_id,
    subtotal, delivery_fee, total
  ) values (
    s.org_id, v_loc, v_number, s.contact_name, s.contact_phone,
    s.address_line, s.city, s.pincode, s.landmark, 'tomorrow_morning',
    'Subscription order', s.user_id, v_total, v_fee, v_total + v_fee
  ) returning id into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit, quantity, unit_price)
  select v_order, p.id, p.name, p.unit, s.quantity, v_price
  from public.products p where p.id = s.product_id;

  insert into public.stock_movements (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
  values (s.org_id, v_loc, s.product_id, -s.quantity, 'order_reserved', 'order', v_order, v_number);

  -- Fire the customer confirmation the same way a normal order does: the trigger
  -- watches for total going from 0 to a value, so nudge it.
  update public.orders set total = v_total + v_fee where id = v_order;

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (s.org_id, v_loc, 'order.placed', 'order', v_order,
          jsonb_build_object('order_number', v_number, 'total', v_total + v_fee, 'subscription', true));

  update public.subscriptions
     set next_run = (next_run + v_step)::date, last_order_at = now()
   where id = p_sub;
  return true;
end $$;
revoke all on function public.run_one_subscription(uuid) from public, anon, authenticated;

-- Cron entry: process everything due today.
create or replace function public.run_due_subscriptions()
returns int language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.subscriptions
           where is_active and next_run <= (now() at time zone 'Asia/Kolkata')::date
  loop
    perform public.run_one_subscription(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.run_due_subscriptions() from public, anon, authenticated;

-- Run daily at 6am IST (00:30 UTC).
select cron.unschedule('run-subscriptions')
 where exists (select 1 from cron.job where jobname = 'run-subscriptions');
select cron.schedule('run-subscriptions', '30 0 * * *',
  $$ select public.run_due_subscriptions(); $$);
