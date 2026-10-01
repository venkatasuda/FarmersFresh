-- Revoke inherited platform defaults as well as PUBLIC access on service-only RPCs.
REVOKE ALL ON FUNCTION public.activate_membership(p_id uuid, p_rp_order text, p_rp_payment text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_draft_reorder(p_lookback integer, p_horizon integer, p_lead integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_stale_unpaid_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_category_depth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notifications(p_limit integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_customer_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_markdowns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_old_batches() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_card_uid(p_uid text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_paid(p_order_id uuid, p_razorpay_order text, p_razorpay_payment text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_restock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.one_default_address() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_sale_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remind_abandoned_carts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_on_delivery() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_due_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_one_subscription(p_sub uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_winback(p_days integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_razorpay_payment(p_payment_id text, p_rp_order text, p_amount integer, p_event text, p_raw jsonb) FROM PUBLIC, anon, authenticated;

-- Table-level UPDATE overrides column restrictions; remove both direct paths.
REVOKE UPDATE ON public.profiles, public.orders FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, confirmed_at, delivered_at) ON public.orders FROM authenticated;
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (updated_at) ON public.orders TO authenticated;

CREATE OR REPLACE FUNCTION public.my_orders() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_phone text; v_email text; v_rows jsonb;
begin
  select nullif(right(regexp_replace(coalesce(u.phone,''), '\D', '', 'g'), 10), ''),
         lower(nullif(trim(coalesce(u.email,'')), ''))
    into v_phone, v_email
  from auth.users u where u.id = auth.uid();

  if v_phone is null and v_email is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(t.o order by t.placed_at desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'order_number', ord.order_number,
      'status', ord.status,
      'total', ord.total,
      'placed_at', ord.placed_at,
      'item_count', (select count(*) from public.order_items oi where oi.order_id = ord.id),
      'items', (select string_agg(oi.product_name, ', ') from public.order_items oi where oi.order_id = ord.id)
    ) as o, ord.placed_at
    from public.orders ord
    where (v_phone is not null and right(ord.contact_phone, 10) = v_phone)
       or (v_email is not null and lower(ord.contact_email) = v_email)
    order by ord.placed_at desc
    limit 50
  ) t;

  return v_rows;
end $$;

-- Function-local values avoid temporary-table name collisions on repeated calls.
CREATE OR REPLACE FUNCTION public.auto_assign_deliveries() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; o record; v_rider uuid; v_n int := 0; v_load jsonb;
begin
  -- A human caller must have delivery.assign; the cron (no auth.uid) is trusted.
  if auth.uid() is not null and not public.has_permission('delivery.assign') then
    raise exception 'Insufficient permissions.' using errcode = '42501';
  end if;

  v_org := coalesce(public.current_org_id(),
    (select id from public.organizations where storefront_location_id is not null limit 1));
  if v_org is null then return 0; end if;

  select coalesce(jsonb_object_agg(user_id, cnt), '{}'::jsonb) into v_load from (
  select m.user_id,
         (select count(*) from public.orders oo
           where oo.org_id = v_org and oo.assigned_to = m.user_id
             and oo.status in ('confirmed','packed','out_for_delivery'))::int as cnt
  from public.memberships m
  where m.org_id = v_org and m.on_shift
  group by m.user_id) loads;

  if v_load = '{}'::jsonb then return 0; end if;

  for o in
    select id, pincode from public.orders
    where org_id = v_org and assigned_to is null
      and status in ('confirmed','packed','out_for_delivery')
    order by pincode nulls last, placed_at
  loop
    select o2.assigned_to into v_rider
      from public.orders o2 join jsonb_each_text(v_load) l on l.key::uuid = o2.assigned_to
     where o2.org_id = v_org and o2.pincode is not distinct from o.pincode
       and o2.status in ('confirmed','packed','out_for_delivery')
     group by o2.assigned_to order by min(l.value::int) asc limit 1;
    if v_rider is null then
      select key::uuid into v_rider from jsonb_each_text(v_load) order by value::int asc, random() limit 1;
    end if;
    update public.orders set assigned_to = v_rider, assigned_at = now() where id = o.id;
    v_load := jsonb_set(v_load, array[v_rider::text], to_jsonb((v_load->>v_rider::text)::int + 1));
    insert into public.events(org_id, actor_id, event_type, entity_type, entity_id, payload)
    values(v_org, auth.uid(), 'order.auto_assigned', 'order', o.id, jsonb_build_object('assigned_to', v_rider));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

CREATE OR REPLACE FUNCTION public.auto_draft_reorder(p_lookback integer DEFAULT 28, p_horizon integer DEFAULT 7, p_lead integer DEFAULT 2) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_loc uuid; v_po uuid; v_num text; v_n int; v_suggestions jsonb;
        lb int := greatest(coalesce(p_lookback,28),1);
        hz int := greatest(coalesce(p_horizon,7),1);
        ld int := greatest(coalesce(p_lead,2),0);
begin
  select id, storefront_location_id into v_org, v_loc
    from public.organizations where storefront_location_id is not null limit 1;
  if v_org is null then return 0; end if;

  if exists (select 1 from public.purchase_orders
             where org_id = v_org and status in ('draft','ordered') and notes = 'Auto reorder') then
    return 0;
  end if;

  with demand as (
    select m.product_id, -sum(m.delta) as qty
    from public.stock_movements m
    where m.org_id = v_org and m.location_id = v_loc
      and m.reason in ('sale','order_reserved','order_released')
      and m.created_at >= now() - make_interval(days => lb)
    group by m.product_id having -sum(m.delta) > 0
  ),
  onhand as (
    select product_id, sum(delta) as qty from public.stock_movements
    where location_id = v_loc group by product_id
  ),
  incoming as (
    select i.product_id, sum(i.qty_ordered - i.qty_received) as qty
    from public.purchase_order_items i
    join public.purchase_orders po on po.id = i.po_id
    where po.status in ('draft','ordered') group by i.product_id
  )
  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_suggestions from (
  select d.product_id, p.name, p.last_cost,
    greatest(0, round(d.qty / lb * (hz + ld) - coalesce(oh.qty,0) - coalesce(inc.qty,0), 1)) as suggested
  from demand d
  join public.products p on p.id = d.product_id and p.is_active
  left join onhand oh on oh.product_id = d.product_id
  left join incoming inc on inc.product_id = d.product_id) s where suggested > 0;

  v_n := jsonb_array_length(v_suggestions);
  if v_n = 0 then return 0; end if;

  v_num := 'PO-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
           lpad(nextval('public.po_number_seq')::text, 4, '0');
  insert into public.purchase_orders (org_id, location_id, po_number, status, notes)
  values (v_org, v_loc, v_num, 'draft', 'Auto reorder') returning id into v_po;

  insert into public.purchase_order_items (po_id, org_id, product_id, product_name, qty_ordered, unit_cost)
  select v_po, v_org, product_id, name, suggested, coalesce(last_cost,0)
  from jsonb_to_recordset(v_suggestions) as s(product_id uuid, name text, suggested numeric, last_cost numeric);

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, 'purchase.auto_drafted', 'purchase_order', v_po,
          jsonb_build_object('items', v_n, 'po_number', v_num));
  return v_n;
end $$;
