-- Finance scope must come from the capability-bearing assignment, not any role at a store.
create function public.financial_report_locations() returns uuid[]
language plpgsql stable security definer set search_path='' as $$
declare v_locations uuid[];
begin
  perform public.require_permission('financials.read');
  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_locations
  from public.locations l
  where l.org_id=public.current_org_id() and (public.is_org_owner() or exists (
    select 1 from public.memberships m
    join public.role_capabilities rc on rc.role=m.role and rc.capability='financials.read'
    where m.user_id=auth.uid() and m.org_id=l.org_id and m.location_id=l.id
  ));
  return v_locations;
end $$;
revoke all on function public.financial_report_locations() from public,anon;
grant execute on function public.financial_report_locations() to authenticated,service_role;

CREATE OR REPLACE FUNCTION public.financials_overview(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.require_permission('financials.read');
  with li as (
    select oi.quantity, oi.line_total, p.last_cost
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.org_id = public.current_org_id() and o.status <> 'cancelled'
      and o.location_id = any(public.financial_report_locations())
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
      and o.location_id = any(public.financial_report_locations())
                      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1)))
  ) from agg;
$$;

CREATE OR REPLACE FUNCTION public.margin_by_product(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      and o.location_id = any(public.financial_report_locations())
      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
    group by p.id, p.name, p.sale_price, p.last_cost order by revenue desc limit 100
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.sales_by_payment(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_method', payment_method, 'orders', orders, 'revenue', round(revenue,2)
  ) order by revenue desc), '[]'::jsonb)
  from (
    select coalesce(payment_method,'unknown') as payment_method, count(*) as orders, sum(total) as revenue
    from public.orders
    where org_id = public.current_org_id() and status <> 'cancelled'
      and location_id = any(public.financial_report_locations())
      and placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
    group by coalesce(payment_method,'unknown')
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.price_check(p_threshold numeric DEFAULT 10) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', name, 'sale_price', sale_price, 'last_cost', last_cost, 'margin_pct', margin_pct
  ) order by margin_pct asc), '[]'::jsonb)
  from (
    select p.name, p.sale_price, p.last_cost,
           case when p.sale_price > 0 then round((p.sale_price - p.last_cost)/p.sale_price*100,1) else 0 end as margin_pct
    from public.products p
    where p.org_id = public.current_org_id()
      and (public.is_org_owner() or exists (
        select 1 from public.stock_movements sm where sm.product_id=p.id
          and sm.org_id=p.org_id and sm.location_id=any(public.financial_report_locations())
      )) and p.is_active and p.last_cost is not null
      and (p.sale_price = 0 or (p.sale_price - p.last_cost)/p.sale_price*100 < greatest(coalesce(p_threshold,10),0))
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.payment_reconciliation(p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', razorpay_payment_id, 'order_id', razorpay_order_id,
    'amount', amount, 'status', status, 'target', target_type, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from public.payment_events
  where org_id = public.current_org_id()
    and (public.is_org_owner() or (target_type='order' and exists (
      select 1 from public.orders o where o.id=target_id and o.org_id=public.current_org_id()
        and o.location_id=any(public.financial_report_locations())
    )))
    and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1));
$$;

CREATE OR REPLACE FUNCTION public.business_overview() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_org uuid; v_loc uuid; v_today date;
  rev_today numeric; orders_today int; pos_today numeric; open_orders int; rev_week numeric;
  top jsonb; low_stock jsonb; pts_out numeric; members int; subs int;
  total_cust int; repeat_cust int;
begin
  perform public.require_permission('financials.read');
  if not public.is_org_owner() then
    raise exception 'Insufficient permission.' using errcode='42501';
  end if;
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select storefront_location_id into v_loc from public.organizations where id = v_org;
  v_today := (now() at time zone 'Asia/Kolkata')::date;

  select count(*), coalesce(sum(total),0) into orders_today, rev_today
  from public.orders
  where org_id = v_org and status not in ('cancelled','pending_payment')
    and (placed_at at time zone 'Asia/Kolkata')::date = v_today;

  select coalesce(sum(total),0) into pos_today
  from public.sales
  where org_id = v_org and (created_at at time zone 'Asia/Kolkata')::date = v_today;

  rev_today := rev_today + pos_today;

  select count(*) into open_orders from public.orders
   where org_id = v_org and status not in ('delivered','cancelled','pending_payment');

  select coalesce(sum(total),0) into rev_week from (
    select total from public.orders
      where org_id = v_org and status not in ('cancelled','pending_payment')
        and placed_at > now() - interval '7 days'
    union all
    select total from public.sales
      where org_id = v_org and created_at > now() - interval '7 days'
  ) x;

  select jsonb_agg(t) into top from (
    select name, sum(qty) as qty, sum(revenue) as revenue from (
      select oi.product_name as name, oi.quantity as qty, oi.line_total as revenue
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.org_id = v_org and o.status <> 'cancelled'
        and o.placed_at > now() - interval '30 days'
      union all
      select p.name, si.quantity, si.line_total
      from public.sale_items si join public.sales s on s.id = si.sale_id
        join public.products p on p.id = si.product_id
      where s.org_id = v_org and s.created_at > now() - interval '30 days'
    ) u group by name order by revenue desc limit 5
  ) t;

  select jsonb_agg(t) into low_stock from (
    select p.name, public.stock_available(v_loc, p.id) as on_hand, p.unit
    from public.products p
    where p.org_id = v_org and p.is_published and p.is_active
    order by public.stock_available(v_loc, p.id) asc
    limit 5
  ) t;

  select coalesce(sum(amount),0) into pts_out from public.wallet_ledger where org_id = v_org;
  select count(*) into members from (
    select user_id from public.wallet_ledger where org_id = v_org
    group by user_id having sum(amount) > 0
  ) m;
  select count(*) into subs from public.subscriptions where org_id = v_org and is_active;

  select count(distinct contact_phone) into total_cust
   from public.orders where org_id = v_org and status <> 'cancelled';
  select count(*) into repeat_cust from (
    select contact_phone from public.orders where org_id = v_org and status <> 'cancelled'
    group by contact_phone having count(*) >= 2
  ) r;

  return jsonb_build_object(
    'revenue_today', rev_today, 'orders_today', orders_today,
    'open_orders', open_orders, 'revenue_week', rev_week,
    'top_products', coalesce(top, '[]'::jsonb),
    'low_stock', coalesce(low_stock, '[]'::jsonb),
    'points_outstanding', pts_out, 'loyalty_members', members,
    'active_subscriptions', subs,
    'total_customers', total_cust, 'repeat_customers', repeat_cust
  );
end $$;
