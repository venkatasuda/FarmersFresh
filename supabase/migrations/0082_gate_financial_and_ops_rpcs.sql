-- =====================================================================
-- Migration 0082: gate the highest-risk admin RPCs with the capability check.
-- require_permission() raises if the caller lacks the capability; it is the
-- first statement of each function, so it runs before any data is returned.
-- Financial reads require 'financials.read'; auto_assign_deliveries requires
-- 'delivery.assign' for a human caller (the cron path, auth.uid() null, is
-- trusted) and no longer lets an ordinary customer trigger it.
-- This is the FIRST batch — remaining admin RPCs (procurement, coupons, gift
-- cards, recipes, settings, markdown, inventory writes) still need the same
-- guard. Applied live to bjevoybwufubtprkxbvb.
-- =====================================================================
create or replace function public.require_permission(p_capability text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission(p_capability) then
    raise exception 'Insufficient permissions.' using errcode = '42501';
  end if;
  return true;
end $$;
revoke all on function public.require_permission(text) from public, anon;
grant execute on function public.require_permission(text) to authenticated;

create or replace function public.financials_overview(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.require_permission('financials.read');
  with li as (
    select oi.quantity, oi.line_total, p.last_cost
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.org_id = public.current_org_id() and o.status <> 'cancelled'
      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
  ),
  agg as (
    select coalesce(sum(line_total),0) as revenue,
           coalesce(sum(quantity * coalesce(last_cost,0)),0) as cogs,
           coalesce(sum(line_total) filter (where last_cost is not null),0) as costed_revenue
    from li
  )
  select jsonb_build_object(
    'revenue', round(revenue,2), 'cogs', round(cogs,2),
    'gross_profit', round(revenue - cogs,2),
    'margin_pct', case when revenue > 0 then round((revenue - cogs)/revenue*100,1) else 0 end,
    'costed_pct', case when revenue > 0 then round(costed_revenue/revenue*100,1) else 0 end,
    'order_count', (select count(distinct o.id) from public.orders o
                    where o.org_id = public.current_org_id() and o.status <> 'cancelled'
                      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1)))
  ) from agg;
$$;

create or replace function public.margin_by_product(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', product_name, 'units', round(units,3), 'revenue', round(revenue,2),
    'cost', round(cost,2), 'profit', round(revenue - cost,2),
    'margin_pct', case when revenue > 0 then round((revenue-cost)/revenue*100,1) else 0 end,
    'sale_price', sale_price, 'last_cost', last_cost) order by revenue desc), '[]'::jsonb)
  from (
    select p.name as product_name, p.sale_price, p.last_cost,
           sum(oi.quantity) as units, sum(oi.line_total) as revenue,
           sum(oi.quantity * coalesce(p.last_cost,0)) as cost
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.org_id = public.current_org_id() and o.status <> 'cancelled'
      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
    group by p.id, p.name, p.sale_price, p.last_cost order by revenue desc limit 100
  ) t;
$$;

create or replace function public.sales_by_payment(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_method', payment_method, 'orders', orders, 'revenue', round(revenue,2)
  ) order by revenue desc), '[]'::jsonb)
  from (
    select coalesce(payment_method,'unknown') as payment_method, count(*) as orders, sum(total) as revenue
    from public.orders
    where org_id = public.current_org_id() and status <> 'cancelled'
      and placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
    group by coalesce(payment_method,'unknown')
  ) t;
$$;

create or replace function public.price_check(p_threshold numeric default 10)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', name, 'sale_price', sale_price, 'last_cost', last_cost, 'margin_pct', margin_pct
  ) order by margin_pct asc), '[]'::jsonb)
  from (
    select p.name, p.sale_price, p.last_cost,
           case when p.sale_price > 0 then round((p.sale_price - p.last_cost)/p.sale_price*100,1) else 0 end as margin_pct
    from public.products p
    where p.org_id = public.current_org_id() and p.is_active and p.last_cost is not null
      and (p.sale_price = 0 or (p.sale_price - p.last_cost)/p.sale_price*100 < greatest(coalesce(p_threshold,10),0))
  ) t;
$$;

create or replace function public.payment_reconciliation(p_days int default 7)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', razorpay_payment_id, 'order_id', razorpay_order_id,
    'amount', amount, 'status', status, 'target', target_type, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from public.payment_events
  where org_id = public.current_org_id()
    and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1));
$$;

create or replace function public.auto_assign_deliveries()
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; o record; v_rider uuid; v_n int := 0;
begin
  if auth.uid() is not null and not public.has_permission('delivery.assign') then
    raise exception 'Insufficient permissions.' using errcode = '42501';
  end if;

  v_org := coalesce(public.current_org_id(),
    (select id from public.organizations where storefront_location_id is not null limit 1));
  if v_org is null then return 0; end if;

  create temp table _load on commit drop as
  select m.user_id,
         (select count(*) from public.orders oo
           where oo.org_id = v_org and oo.assigned_to = m.user_id
             and oo.status in ('confirmed','packed','out_for_delivery'))::int as cnt
  from public.memberships m
  where m.org_id = v_org and m.on_shift
  group by m.user_id;

  if not exists (select 1 from _load) then return 0; end if;

  for o in
    select id, pincode from public.orders
    where org_id = v_org and assigned_to is null
      and status in ('confirmed','packed','out_for_delivery')
    order by pincode nulls last, placed_at
  loop
    select o2.assigned_to into v_rider
      from public.orders o2 join _load l on l.user_id = o2.assigned_to
     where o2.org_id = v_org and o2.pincode is not distinct from o.pincode
       and o2.status in ('confirmed','packed','out_for_delivery')
     group by o2.assigned_to order by min(l.cnt) asc limit 1;
    if v_rider is null then
      select user_id into v_rider from _load order by cnt asc, random() limit 1;
    end if;
    update public.orders set assigned_to = v_rider, assigned_at = now() where id = o.id;
    update _load set cnt = cnt + 1 where user_id = v_rider;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
