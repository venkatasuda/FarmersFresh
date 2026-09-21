--
-- PostgreSQL database dump
--

\restrict 6qGtetGcb8wTfi0g6hKHGp7qujZ1y9Ex9UIQ9Ky7ZB5YFlfNhkv3q9mdBDcweD5

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cart_line; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cart_line AS (
	product_id uuid,
	quantity numeric
);


--
-- Name: sale_line; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sale_line AS (
	product_id uuid,
	quantity numeric,
	unit_price numeric
);


--
-- Name: activate_membership(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_membership(p_id uuid, p_rp_order text, p_rp_payment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_m record;
begin
  select mm.*, p.duration_days into v_m
  from public.pass_memberships mm join public.membership_plans p on p.id = mm.plan_id
  where mm.id = p_id;
  if v_m.id is null then raise exception 'Membership not found.'; end if;
  if v_m.status = 'active' then return; end if;

  update public.pass_memberships
     set status = 'active', starts_at = now(),
         expires_at = now() + make_interval(days => v_m.duration_days),
         razorpay_order_id = p_rp_order, razorpay_payment_id = p_rp_payment
   where id = p_id;

  insert into public.events (org_id, event_type, entity_type, entity_id, payload)
  values (v_m.org_id, 'membership.activated', 'membership', p_id,
          jsonb_build_object('user_id', v_m.user_id));
end $$;


--
-- Name: active_banners(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.active_banners() RETURNS TABLE(id uuid, title text, subtitle text, cta_label text, href text, bg_from text, bg_to text, image_path text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.id, b.title, b.subtitle, b.cta_label, b.href, b.bg_from, b.bg_to, b.image_path
  from public.banners b
  join public.organizations o on o.id = b.org_id
  where b.is_active and o.storefront_enabled
    and (b.starts_at is null or now() >= b.starts_at)
    and (b.ends_at is null or now() <= b.ends_at)
  order by b.sort_order, b.created_at;
$$;


--
-- Name: add_batch(uuid, uuid, text, date, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_batch(p_product uuid, p_farm uuid, p_batch_code text, p_source_date date, p_quantity numeric, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not exists (select 1 from public.products where id = p_product and org_id = v_org) then
    raise exception 'Product not found.';
  end if;
  if coalesce(trim(p_batch_code),'') = '' then raise exception 'A batch needs a code.'; end if;
  insert into public.product_batches (org_id, product_id, farm_id, batch_code, source_date, quantity, notes, created_by)
  values (v_org, p_product, p_farm, trim(p_batch_code), p_source_date, p_quantity,
          nullif(trim(coalesce(p_notes,'')),''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: add_farm(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_farm(p_name text, p_location text, p_kind text, p_contact text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'A farm needs a name.'; end if;
  insert into public.farms (org_id, name, location, kind, contact, notes)
  values (v_org, trim(p_name), nullif(trim(coalesce(p_location,'')),''),
          case when lower(coalesce(p_kind,'')) = 'partner' then 'partner' else 'own' end,
          nullif(trim(coalesce(p_contact,'')),''), nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: add_po_item(uuid, uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_po_item(p_po uuid, p_product uuid, p_qty numeric, p_unit_cost numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_status text; v_name text; v_id uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if v_status <> 'draft' then raise exception 'You can only add items while the order is a draft.'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  select name into v_name from public.products where id = p_product and org_id = v_org;
  if v_name is null then raise exception 'Product not found.'; end if;
  insert into public.purchase_order_items (po_id, org_id, product_id, product_name, qty_ordered, unit_cost)
  values (p_po, v_org, p_product, v_name, p_qty, greatest(coalesce(p_unit_cost,0),0))
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: add_recipe_item(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_recipe_item(p_recipe uuid, p_product uuid, p_qty numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not exists (select 1 from public.recipes where id = p_recipe and org_id = v_org) then raise exception 'Recipe not found.'; end if;
  if not exists (select 1 from public.products where id = p_product and org_id = v_org) then raise exception 'Product not found.'; end if;
  if not (coalesce(p_qty,0) > 0) then raise exception 'Quantity must be above zero.'; end if;
  insert into public.recipe_items (recipe_id, product_id, qty) values (p_recipe, p_product, p_qty);
end $$;


--
-- Name: add_review(uuid, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_review(p_product uuid, p_name text, p_rating integer, p_body text, p_contact text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_hash text; v_phone text; v_email text; v_verified boolean := false;
begin
  v_org := public.storefront_org_id();
  if v_org is null then return jsonb_build_object('ok', false, 'message', 'Shop not open.'); end if;

  if not exists (select 1 from public.products where id = p_product and org_id = v_org and is_published) then
    return jsonb_build_object('ok', false, 'message', 'Product not found.');
  end if;
  if coalesce(trim(p_name),'') = '' then
    return jsonb_build_object('ok', false, 'message', 'Please add your name.'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'message', 'Pick a rating from 1 to 5.'); end if;

  -- Contact (optional) is only used to dedupe and to verify a purchase; stored
  -- as a hash, never in the clear.
  if coalesce(trim(p_contact),'') <> '' then
    v_hash := md5(lower(trim(p_contact)));
    -- Verify purchase: does an order with this phone/email include the product?
    v_phone := nullif(right(regexp_replace(p_contact, '\D','','g'), 10), '');
    v_email := lower(nullif(trim(p_contact), ''));
    select exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.org_id = v_org and oi.product_id = p_product
        and ((v_phone is not null and right(o.contact_phone,10) = v_phone)
          or (v_email is not null and lower(o.contact_email) = v_email))
    ) into v_verified;
  end if;

  begin
    insert into public.reviews (org_id, product_id, author_name, rating, body, contact_hash, verified)
    values (v_org, p_product, trim(p_name), p_rating, nullif(trim(coalesce(p_body,'')), ''), v_hash, v_verified);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'message', 'You''ve already reviewed this item.');
  end;

  return jsonb_build_object('ok', true, 'verified', v_verified);
end $$;


--
-- Name: add_to_order(text, public.cart_line[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_to_order(p_number text, p_lines public.cart_line[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_o record; v_loc uuid; v_line public.cart_line; v_name text;
  v_new_sub numeric(12,2); v_new_total numeric(12,2); v_added int := 0;
begin
  perform public.require_permission('orders.manage');
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please sign in.'); end if;
  select * into v_o from public.orders where upper(order_number) = upper(trim(p_number)) and user_id = v_uid;
  if v_o.id is null then return jsonb_build_object('ok', false, 'message', 'Order not found.'); end if;
  if v_o.status <> 'placed' or v_o.payment_method in ('upi','card') then
    return jsonb_build_object('ok', false, 'message', 'This order can no longer be changed.');
  end if;
  if v_o.placed_at < now() - interval '15 minutes' then
    return jsonb_build_object('ok', false, 'message', 'The window to add items has closed.');
  end if;
  v_loc := v_o.location_id;

  perform 1 from public.stock_movements
   where location_id = v_loc
     and product_id in (select (l).product_id from unnest(p_lines) l)
   for update;

  foreach v_line in array p_lines loop
    select name into v_name from public.products
     where id = v_line.product_id and org_id = v_o.org_id and is_published and is_active and sale_price is not null;
    if v_name is null then continue; end if;
    if v_line.quantity <= 0 or v_line.quantity > 50 then continue; end if;
    if public.stock_available(v_loc, v_line.product_id) < v_line.quantity then continue; end if;

    insert into public.order_items (order_id, product_id, product_name, unit, quantity, unit_price)
    select v_o.id, p.id, p.name, p.unit, v_line.quantity, p.sale_price
    from public.products p where p.id = v_line.product_id;

    insert into public.stock_movements (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
    values (v_o.org_id, v_loc, v_line.product_id, -v_line.quantity, 'order_reserved', 'order', v_o.id, v_o.order_number);
    v_added := v_added + 1;
  end loop;

  if v_added = 0 then return jsonb_build_object('ok', false, 'message', 'Nothing could be added (out of stock).'); end if;

  select coalesce(sum(line_total),0) into v_new_sub from public.order_items where order_id = v_o.id;
  v_new_total := greatest(v_new_sub - coalesce(v_o.discount,0) - coalesce(v_o.credit_used,0), 0) + coalesce(v_o.delivery_fee,0);
  update public.orders set subtotal = v_new_sub, total = v_new_total where id = v_o.id;
  return jsonb_build_object('ok', true, 'total', v_new_total, 'added', v_added);
end $$;


--
-- Name: apply_markdown(uuid, numeric, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_markdown(p_product uuid, p_price numeric, p_ends date, p_reason text DEFAULT 'short_dated'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; p record; v_exist uuid;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select id, sale_price, compare_at_price, badge, last_cost into p
    from public.products where id = p_product and org_id = v_org;
  if p.id is null then raise exception 'Product not found.'; end if;
  if coalesce(p_price,0) <= 0 then raise exception 'Enter a clearance price.'; end if;
  if p.last_cost is not null and p_price < p.last_cost then
    raise exception 'Clearance price is below cost — you would lose money.';
  end if;
  if p_price >= p.sale_price then raise exception 'Clearance must be below the current price.'; end if;

  select id into v_exist from public.markdowns where product_id = p_product and active;
  if v_exist is not null then
    -- Keep the true originals; just change the clearance + window.
    update public.markdowns set clearance_price = p_price, ends_on = p_ends, reason = p_reason
     where id = v_exist;
  else
    insert into public.markdowns (org_id, product_id, clearance_price, orig_sale_price,
      orig_compare_at, orig_badge, reason, ends_on, created_by)
    values (v_org, p_product, p_price, p.sale_price, p.compare_at_price, p.badge, p_reason, p_ends, auth.uid());
  end if;

  update public.products
     set sale_price = p_price,
         compare_at_price = coalesce((select orig_sale_price from public.markdowns where product_id = p_product and active), p.sale_price),
         badge = 'Reduced', updated_at = now()
   where id = p_product;
end $$;


--
-- Name: approve_return(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_return(p_id uuid, p_refund_points numeric DEFAULT 0, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_r record; v_pts numeric;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_r from public.returns where id = p_id and org_id = v_org;
  if v_r.id is null then raise exception 'Return not found.'; end if;
  if v_r.status <> 'requested' then raise exception 'This request is already resolved.'; end if;

  v_pts := greatest(coalesce(p_refund_points, 0), 0);
  if v_pts > 0 and v_r.user_id is not null then
    insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
    values (v_org, v_r.user_id, v_pts, 'refund', v_r.order_number);
  end if;

  update public.returns
     set status = 'approved', refund_points = case when v_r.user_id is not null then v_pts else 0 end,
         staff_note = nullif(trim(coalesce(p_note,'')),''), resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;

  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), 'return.approved', 'return', p_id,
          jsonb_build_object('order_number', v_r.order_number, 'refund_points', v_pts));
end $$;


--
-- Name: attach_order_location(uuid, double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_order_location(p_order_id uuid, p_lat double precision, p_lng double precision) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return;
  end if;
  update public.orders
     set address_lat = p_lat, address_lng = p_lng
   where id = p_order_id and address_lat is null and placed_at > now() - interval '30 minutes';
end $$;


--
-- Name: auto_assign_deliveries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_deliveries() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; o record; v_rider uuid; v_n int := 0;
begin
  -- A human caller must have delivery.assign; the cron (no auth.uid) is trusted.
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


--
-- Name: auto_draft_reorder(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_draft_reorder(p_lookback integer DEFAULT 28, p_horizon integer DEFAULT 7, p_lead integer DEFAULT 2) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_loc uuid; v_po uuid; v_num text; v_n int;
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

  create temp table _sug on commit drop as
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
  select d.product_id, p.name, p.last_cost,
    greatest(0, round(d.qty / lb * (hz + ld) - coalesce(oh.qty,0) - coalesce(inc.qty,0), 1)) as suggested
  from demand d
  join public.products p on p.id = d.product_id and p.is_active
  left join onhand oh on oh.product_id = d.product_id
  left join incoming inc on inc.product_id = d.product_id;

  select count(*) into v_n from _sug where suggested > 0;
  if v_n = 0 then return 0; end if;

  v_num := 'PO-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
           lpad(nextval('public.po_number_seq')::text, 4, '0');
  insert into public.purchase_orders (org_id, location_id, po_number, status, notes)
  values (v_org, v_loc, v_num, 'draft', 'Auto reorder') returning id into v_po;

  insert into public.purchase_order_items (po_id, org_id, product_id, product_name, qty_ordered, unit_cost)
  select v_po, v_org, product_id, name, suggested, coalesce(last_cost,0)
  from _sug where suggested > 0;

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, 'purchase.auto_drafted', 'purchase_order', v_po,
          jsonb_build_object('items', v_n, 'po_number', v_num));
  return v_n;
end $$;


--
-- Name: batches_for_product(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.batches_for_product(p_product uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'batch_code', b.batch_code, 'source', b.source,
    'remaining', round(b.remaining_qty,3), 'received', round(b.received_qty,3),
    'unit_cost', b.unit_cost, 'expiry_date', b.expiry_date, 'status', b.status,
    'created_at', b.created_at
  ) order by b.expiry_date nulls last, b.created_at), '[]'::jsonb)
  from public.product_batches b
  where b.org_id = public.current_org_id() and b.product_id = p_product
    and b.remaining_qty > 0;
$$;


--
-- Name: bestseller_ids(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bestseller_ids(p_limit integer DEFAULT 8) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select product_id from (
    select oi.product_id, sum(oi.quantity) as q
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where o.org_id = public.storefront_org_id() and o.status <> 'cancelled'
      and o.placed_at > now() - interval '30 days'
    group by oi.product_id
    union all
    select si.product_id, sum(si.quantity)
    from public.sale_items si join public.sales s on s.id = si.sale_id
    where s.org_id = public.storefront_org_id() and s.created_at > now() - interval '30 days'
    group by si.product_id
  ) u
  group by product_id
  order by sum(q) desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;


--
-- Name: block_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  raise exception 'This table is append-only; % is not allowed', tg_op;
end $$;


--
-- Name: business_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.business_overview() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org uuid; v_loc uuid; v_today date;
  rev_today numeric; orders_today int; pos_today numeric; open_orders int; rev_week numeric;
  top jsonb; low_stock jsonb; pts_out numeric; members int; subs int;
  total_cust int; repeat_cust int;
begin
  perform public.require_permission('financials.read');
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


--
-- Name: cancel_order(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_o record; v_it record;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;

  select * into v_o from public.orders o where o.id = p_order_id and o.org_id = v_org;
  if v_o is null then raise exception 'Order not found.'; end if;
  if v_o.status = 'cancelled' then return; end if;
  if v_o.status = 'delivered' then
    raise exception 'A delivered order cannot be cancelled.';
  end if;

  for v_it in select * from public.order_items oi where oi.order_id = p_order_id loop
    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note)
    values (v_org, v_o.location_id, v_it.product_id, v_it.quantity,
            'order_released', 'order', p_order_id, auth.uid(), v_o.order_number);
  end loop;

  update public.orders o
     set status = 'cancelled', cancelled_reason = p_reason
   where o.id = p_order_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_o.location_id, auth.uid(), 'order.cancelled', 'order', p_order_id,
          jsonb_build_object('order_number', v_o.order_number, 'reason', p_reason));
end $$;


--
-- Name: cancel_purchase_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_purchase_order(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_status text;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if v_status = 'received' then raise exception 'A received order cannot be cancelled.'; end if;
  update public.purchase_orders set status = 'cancelled', updated_at = now()
   where id = p_po and org_id = v_org;
end $$;


--
-- Name: cancel_stale_unpaid_orders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_stale_unpaid_orders() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; v_it record; n int := 0;
begin
  for r in
    select * from public.orders
     where status = 'pending_payment' and not is_paid
       and placed_at < now() - interval '30 minutes'
     for update skip locked
  loop
    for v_it in select * from public.order_items where order_id = r.id loop
      insert into public.stock_movements
        (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
      values (r.org_id, r.location_id, v_it.product_id, v_it.quantity,
              'order_released', 'order', r.id, r.order_number);
    end loop;

    if coalesce(r.credit_used,0) > 0 and r.user_id is not null then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (r.org_id, r.user_id, r.credit_used, 'refunded', r.order_number);
    end if;

    if r.coupon_code is not null then
      update public.coupons set used_count = greatest(used_count - 1, 0)
       where org_id = r.org_id and upper(code) = upper(r.coupon_code);
    end if;

    update public.orders
       set status = 'cancelled', cancelled_reason = 'Payment not completed'
     where id = r.id;

    insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
    values (r.org_id, r.location_id, 'order.payment_expired', 'order', r.id,
            jsonb_build_object('order_number', r.order_number));
    n := n + 1;
  end loop;
  return n;
end $$;


--
-- Name: cart_recommendations(uuid[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cart_recommendations(p_products uuid[], p_limit integer DEFAULT 6) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with org as (select public.storefront_org_id() as id),
  stock as (select * from public.in_stock_products((select id from org))),
  depts as (
    select distinct public.product_department(pid) as slug
    from unnest(p_products) as pid
  ),
  co as (
    select oi2.product_id, count(*) * 100.0 as score
    from public.order_items oi1
    join public.order_items oi2
      on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
    join public.orders o on o.id = oi1.order_id and o.status <> 'cancelled'
    where oi1.product_id = any(p_products)
    group by oi2.product_id
  ),
  aff as (
    select s.product_id, sum(a.weight) as score
    from public.category_affinity a
    join depts d on d.slug = a.from_slug
    join stock s on s.department = a.to_slug
    where a.org_id = (select id from org)
    group by s.product_id
  )
  select product_id from (
    select s.product_id, coalesce(sum(x.score),0) as score
    from stock s
    left join (select * from co union all select * from aff) x on x.product_id = s.product_id
    where not (s.product_id = any(p_products))
    group by s.product_id
    having coalesce(sum(x.score),0) > 0
    order by score desc, random()
    limit p_limit
  ) ranked;
$$;


--
-- Name: catalogue_by_category(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogue_by_category(p_slug text) RETURNS TABLE(product_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id
  from public.products p
  join public.organizations o on o.id = p.org_id
  join public.categories c on c.id = p.category_id
  left join public.categories parent on parent.id = c.parent_id
  where p.is_published and p.is_active and o.storefront_enabled
    and (c.slug = p_slug or parent.slug = p_slug)
  order by c.sort_order, p.sort_order, p.name;
$$;


--
-- Name: catalogue_categories(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogue_categories() RETURNS TABLE(id uuid, parent_id uuid, slug text, name text, icon text, sort_order integer, product_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with live as (
    select p.category_id, count(*) as n
    from public.products p
    join public.organizations o on o.id = p.org_id
    where p.is_published and p.is_active and o.storefront_enabled
    group by p.category_id
  )
  select c.id, c.parent_id, c.slug, c.name, c.icon, c.sort_order,
         coalesce(direct.n, 0) + coalesce(kids.n, 0) as product_count
  from public.categories c
  join public.organizations o on o.id = c.org_id
  left join live direct on direct.category_id = c.id
  left join lateral (
    select sum(l.n) as n
    from public.categories child
    join live l on l.category_id = child.id
    where child.parent_id = c.id
  ) kids on true
  where c.is_active and o.storefront_enabled
  order by c.sort_order, c.name;
$$;


--
-- Name: catalogue_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogue_stock() RETURNS TABLE(product_id uuid, in_stock boolean, low boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id,
         (coalesce(soh.qty, 0) >= p.min_order_qty) as in_stock,
         (coalesce(soh.qty, 0) >= p.min_order_qty
           and coalesce(soh.qty, 0) <= (case when p.unit = 'kg' then 3 else 5 end)) as low
  from public.products p
  join public.organizations o on o.id = p.org_id
  left join (
    select m.location_id, m.product_id, sum(m.delta) as qty
    from public.stock_movements m
    group by m.location_id, m.product_id
  ) soh on soh.product_id = p.id and soh.location_id = o.storefront_location_id
  where p.is_published and p.is_active and o.storefront_enabled;
$$;


--
-- Name: check_category_depth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_category_depth() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_grandparent uuid;
begin
  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent.';
  end if;
  if new.parent_id is not null then
    select parent_id into v_grandparent from public.categories where id = new.parent_id;
    if v_grandparent is not null then
      raise exception 'Categories are limited to two levels.';
    end if;
  end if;
  return new;
end $$;


--
-- Name: claim_delivery(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_delivery(p_order_id uuid, p_take boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: claim_notifications(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_notifications(p_limit integer DEFAULT 25) RETURNS TABLE(id bigint, channel text, recipient text, template text, payload jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.notifications n
     set status = 'sending', claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select c.id from public.notifications c
      where c.status = 'pending'
         or (c.status = 'sending' and c.claimed_at < now() - interval '15 minutes')
      order by c.created_at
      for update skip locked
      limit greatest(coalesce(p_limit, 25), 1)
   )
  returning n.id, n.channel, n.recipient, n.template, n.payload;
$$;


--
-- Name: clear_cart(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_cart() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then return; end if;
  delete from public.saved_carts where user_id = auth.uid();
end $$;


--
-- Name: create_purchase_order(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_purchase_order(p_location uuid, p_supplier uuid, p_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid; v_number text;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that location.';
  end if;
  v_number := 'PO-' || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
              || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
  insert into public.purchase_orders (org_id, location_id, supplier_id, po_number, notes, created_by)
  values (v_org, p_location, p_supplier, v_number, nullif(trim(coalesce(p_notes,'')),''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'po_number', v_number);
end $$;


--
-- Name: create_recipe(text, text, boolean, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_recipe(p_name text, p_cuisine text, p_is_diet boolean, p_servings integer, p_description text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_cuisine),'')='' then raise exception 'Name and cuisine are required.'; end if;
  insert into public.recipes (org_id, name, cuisine, is_diet, servings, description)
  values (v_org, trim(p_name), trim(p_cuisine), coalesce(p_is_diet,false), greatest(coalesce(p_servings,4),1),
          nullif(trim(coalesce(p_description,'')),''))
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: create_support_ticket(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_support_ticket(p_subject text, p_message text, p_order_number text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_org uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please sign in to contact us.'); end if;
  if coalesce(trim(p_subject),'') = '' or coalesce(trim(p_message),'') = '' then
    return jsonb_build_object('ok', false, 'message', 'Add a subject and a message.');
  end if;
  select public.storefront_org_id() into v_org;
  if v_org is null then return jsonb_build_object('ok', false, 'message', 'The shop is unavailable.'); end if;

  insert into public.support_tickets (org_id, user_id, order_number, subject, message)
  values (v_org, v_uid, nullif(trim(coalesce(p_order_number,'')),''),
          left(trim(p_subject), 200), left(trim(p_message), 2000));
  return jsonb_build_object('ok', true, 'message', 'Thanks — we''ve got your message and will reply soon.');
end $$;


--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select org_id from public.profiles where id = auth.uid();
$$;


--
-- Name: delete_push_subscription(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_push_subscription(p_endpoint text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then return; end if;
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = auth.uid();
end $$;


--
-- Name: delivers_to(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delivers_to(p_org uuid, p_pincode text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.delivery_zones
    where org_id = p_org and is_active
      and pincode = regexp_replace(coalesce(p_pincode, ''), '\s', '', 'g')
  );
$$;


--
-- Name: demand_insights(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demand_insights() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_loc uuid; r jsonb;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then raise exception 'Owners only.'; end if;

  select storefront_location_id into v_loc from public.organizations where id = v_org;

  select jsonb_build_object(
    -- Sales by day of week, last 30 days (which days are busy)
    'by_weekday', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'revenue', rev) order by dow)
      from (
        select to_char(s.sale_date at time zone 'Asia/Kolkata', 'Dy') as d,
               extract(dow from s.sale_date at time zone 'Asia/Kolkata') as dow,
               sum(s.total) as rev
        from public.sales s
        where s.org_id = v_org
          and s.sale_date > now() - interval '30 days'
        group by d, dow
      ) w), '[]'::jsonb),

    -- Reorder guidance: units sold per DAY over the last 14 days vs on hand,
    -- expressed as "days of stock left". Under ~3 days = restock now.
    'reorder', coalesce((
      select jsonb_agg(t order by (t->>'days_left')::numeric asc)
      from (
        select jsonb_build_object(
                 'name', p.name,
                 'on_hand', round(coalesce(soh.qty,0), 1),
                 'per_day', round(coalesce(v.sold,0) / 14.0, 2),
                 'days_left', case when coalesce(v.sold,0) > 0
                               then round(coalesce(soh.qty,0) / (v.sold / 14.0), 1)
                               else null end
               ) as t
        from public.products p
        left join (
          select si.product_id, sum(si.quantity) as sold
          from public.sale_items si
          join public.sales s on s.id = si.sale_id
          where s.org_id = v_org and s.sale_date > now() - interval '14 days'
          group by si.product_id
        ) v on v.product_id = p.id
        left join (
          select product_id, sum(delta) as qty
          from public.stock_movements
          where location_id = v_loc
          group by product_id
        ) soh on soh.product_id = p.id
        where p.org_id = v_org and p.is_published and p.is_active
          and coalesce(v.sold,0) > 0
      ) t
      where (t->>'days_left') is not null and (t->>'days_left')::numeric < 7
    ), '[]'::jsonb),

    -- Trend: this week's revenue vs the week before (momentum)
    'this_week', coalesce((select sum(total) from public.sales
      where org_id = v_org and sale_date > now() - interval '7 days'), 0),
    'last_week', coalesce((select sum(total) from public.sales
      where org_id = v_org and sale_date <= now() - interval '7 days'
        and sale_date > now() - interval '14 days'), 0)
  ) into r;

  return r;
end $$;


--
-- Name: demand_series(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demand_series(p_product uuid, p_days integer DEFAULT 56) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with cfg as (
    select public.current_org_id() as org, greatest(coalesce(p_days,56),1) as days
  ),
  loc as (
    select storefront_location_id as id from public.organizations, cfg
     where organizations.id = cfg.org
  ),
  days as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date - (select days - 1 from cfg),
      (now() at time zone 'Asia/Kolkata')::date,
      interval '1 day')::date as d
  ),
  dem as (
    select (m.created_at at time zone 'Asia/Kolkata')::date as d, -sum(m.delta) as qty
    from public.stock_movements m, cfg, loc
    where m.org_id = cfg.org and m.location_id = loc.id
      and m.product_id = p_product
      and m.reason in ('sale','order_reserved','order_released')
      and m.created_at >= now() - make_interval(days => cfg.days)
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'd', days.d, 'qty', round(coalesce(dem.qty,0),3)) order by days.d), '[]'::jsonb)
  from days left join dem on dem.d = days.d;
$$;


--
-- Name: enqueue_customer_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_customer_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_event text; v_items text;
begin
  if coalesce(old.total,0) = 0 and coalesce(new.total,0) > 0
     and not (coalesce(new.payment_method,'cod') in ('upi','card') and not coalesce(new.is_paid,false)) then
    v_event := 'order.placed.customer';
  elsif coalesce(old.is_paid,false) = false and coalesce(new.is_paid,false) = true
        and coalesce(new.payment_method,'cod') in ('upi','card') then
    v_event := 'order.placed.customer';
  elsif old.status is distinct from new.status
        and new.status in ('confirmed','out_for_delivery','delivered','cancelled') then
    v_event := 'order.' || new.status || '.customer';
  else
    return new;
  end if;

  select string_agg(oi.product_name || ' x ' || oi.quantity, ', ')
    into v_items
  from public.order_items oi where oi.order_id = new.id;

  insert into public.notifications (org_id, channel, recipient, template, payload)
  select new.org_id, ch, new.contact_phone, v_event,
         jsonb_build_object('order_number', new.order_number, 'name', new.contact_name,
                            'total', new.total, 'status', new.status,
                            'items', coalesce(v_items, ''), 'slot', new.delivery_slot)
  from unnest(array['sms','whatsapp']) as ch;

  if new.contact_email is not null then
    insert into public.notifications (org_id, channel, recipient, template, payload)
    values (new.org_id, 'email', new.contact_email, v_event,
            jsonb_build_object('order_number', new.order_number, 'name', new.contact_name,
                               'total', new.total, 'status', new.status,
                               'items', coalesce(v_items, ''), 'slot', new.delivery_slot));
  end if;

  return new;
end $$;


--
-- Name: expire_markdowns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_markdowns() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int := 0; m record;
begin
  for m in select * from public.markdowns where active
             and ends_on < (now() at time zone 'Asia/Kolkata')::date loop
    update public.products set sale_price = m.orig_sale_price,
           compare_at_price = m.orig_compare_at, badge = m.orig_badge, updated_at = now()
     where id = m.product_id;
    update public.markdowns set active = false where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;


--
-- Name: expire_old_batches(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_batches() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  update public.product_batches
     set status = 'expired'
   where status = 'active' and remaining_qty > 0
     and expiry_date is not null
     and expiry_date < (now() at time zone 'Asia/Kolkata')::date;
  get diagnostics n = row_count;
  return n;
end $$;


--
-- Name: expiring_batches(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expiring_batches(p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'product_id', b.product_id, 'product_name', p.name, 'batch_code', b.batch_code,
    'remaining', round(b.remaining_qty,3), 'expiry_date', b.expiry_date,
    'days_left', (b.expiry_date - (now() at time zone 'Asia/Kolkata')::date),
    'value', round(b.remaining_qty * b.unit_cost, 2),
    'sale_price', p.sale_price, 'last_cost', p.last_cost,
    'marked_down', exists(select 1 from public.markdowns m where m.product_id = b.product_id and m.active)
  ) order by b.expiry_date asc), '[]'::jsonb)
  from public.product_batches b
  join public.products p on p.id = b.product_id
  where b.org_id = public.current_org_id()
    and b.status in ('active','expired') and b.remaining_qty > 0
    and b.expiry_date is not null
    and b.expiry_date <= (now() at time zone 'Asia/Kolkata')::date + greatest(coalesce(p_days,7),0);
$$;


--
-- Name: financials_overview(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.financials_overview(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: frequently_bought_together(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.frequently_bought_together(p_product uuid, p_limit integer DEFAULT 4) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with org as (select public.storefront_org_id() as id),
  dept as (select public.product_department(p_product) as slug),
  stock as (select * from public.in_stock_products((select id from org))),
  -- 1) real co-purchase
  co as (
    select oi2.product_id, count(*) * 100.0 as score
    from public.order_items oi1
    join public.order_items oi2
      on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
    join public.orders o on o.id = oi1.order_id and o.status <> 'cancelled'
    where oi1.product_id = p_product
    group by oi2.product_id
  ),
  -- 2) affinity cold-start: in-stock products in paired departments
  aff as (
    select s.product_id, a.weight * 1.0 as score
    from public.category_affinity a
    join stock s on s.department = a.to_slug
    where a.org_id = (select id from org)
      and a.from_slug = (select slug from dept)
  )
  select product_id from (
    select s.product_id, coalesce(sum(x.score), 0)
             + case when s.department = (select slug from dept) then 0.5 else 0 end as score
    from stock s
    left join (select * from co union all select * from aff) x on x.product_id = s.product_id
    where s.product_id <> p_product
    group by s.product_id, s.department
    having coalesce(sum(x.score),0) > 0
    order by score desc, random()
    limit p_limit
  ) ranked;
$$;


--
-- Name: get_admin_recipes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_recipes() RETURNS TABLE(id uuid, name text, cuisine text, is_diet boolean, servings integer, item_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.require_permission('catalogue.write');
  select r.id, r.name, r.cuisine, r.is_diet, r.servings,
         (select count(*)::int from public.recipe_items ri where ri.recipe_id = r.id)
  from public.recipes r where r.org_id = public.current_org_id()
  order by r.created_at desc;
$$;


--
-- Name: get_batches(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_batches(p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, product_name text, farm_name text, batch_code text, source_date date, quantity numeric, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.id, p.name, f.name, b.batch_code, b.source_date, b.quantity, b.created_at
  from public.product_batches b
  join public.products p on p.id = b.product_id
  left join public.farms f on f.id = b.farm_id
  where b.org_id = public.current_org_id()
  order by b.created_at desc
  limit greatest(coalesce(p_limit,50), 1);
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: farms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    location text,
    kind text DEFAULT 'own'::text NOT NULL,
    contact text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT farms_kind_check CHECK ((kind = ANY (ARRAY['own'::text, 'partner'::text])))
);


--
-- Name: get_farms(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_farms() RETURNS SETOF public.farms
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select * from public.farms where org_id = public.current_org_id() order by name;
$$;


--
-- Name: get_hamper(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_hamper(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare h record; v_items jsonb;
begin
  select * into h from public.hampers where id = p_id and org_id = public.storefront_org_id() and is_published;
  if h.id is null then return null; end if;
  select jsonb_agg(jsonb_build_object(
    'product_id', p.id, 'slug', p.slug, 'name', p.name, 'unit', p.unit,
    'price', p.sale_price, 'image_path', p.image_path, 'pack_size', p.pack_size,
    'qty', hi.qty, 'line_cost', round(p.sale_price * hi.qty, 2)
  ) order by p.name)
  into v_items
  from public.hamper_items hi join public.products p on p.id = hi.product_id
  where hi.hamper_id = h.id and p.is_active and p.sale_price is not null;
  return jsonb_build_object('id', h.id, 'name', h.name, 'description', h.description,
    'image_path', h.image_path, 'items', coalesce(v_items,'[]'::jsonb));
end $$;


--
-- Name: get_hampers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_hampers() RETURNS TABLE(id uuid, name text, image_path text, cost numeric, item_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select h.id, h.name, h.image_path,
         round(coalesce(sum(p.sale_price * hi.qty),0),2) as cost,
         count(hi.id)::int as item_count
  from public.hampers h
  join public.hamper_items hi on hi.hamper_id = h.id
  join public.products p on p.id = hi.product_id and p.is_active and p.sale_price is not null
  where h.org_id = public.storefront_org_id() and h.is_published
  group by h.id
  order by h.created_at;
$$;


--
-- Name: membership_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(12,2) NOT NULL,
    duration_days integer NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: get_membership_plans(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_membership_plans() RETURNS SETOF public.membership_plans
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select * from public.membership_plans
   where org_id = public.storefront_org_id() and is_active
   order by price;
$$;


--
-- Name: get_order_receipt(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_receipt(p_number text, p_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_uid uuid; v_phone text; v_o record; v_items jsonb; v_earned numeric; v_store record;
begin
  v_uid := auth.uid();
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');

  if coalesce(trim(p_number), '') = '' then return null; end if;

  select o.* into v_o from public.orders o
   where upper(o.order_number) = upper(trim(p_number));
  if v_o.id is null then return null; end if;

  if not (
    (v_uid is not null and v_o.user_id = v_uid)
    or (v_phone ~ '^[6-9][0-9]{9}$' and v_o.contact_phone = v_phone)
  ) then
    return null;
  end if;

  select jsonb_agg(jsonb_build_object(
           'name', oi.product_name, 'quantity', oi.quantity, 'unit', oi.unit,
           'unit_price', oi.unit_price, 'line_total', oi.line_total
         ) order by oi.product_name)
    into v_items
  from public.order_items oi where oi.order_id = v_o.id;

  select coalesce(sum(amount), 0) into v_earned
  from public.wallet_ledger
  where reason = 'points' and ref = v_o.order_number and user_id = v_o.user_id;

  select name, gstin, business_address, support_phone
    into v_store from public.organizations where id = v_o.org_id;

  return jsonb_build_object(
    'order_number', v_o.order_number,
    'placed_at', v_o.placed_at,
    'status', v_o.status,
    'is_paid', v_o.is_paid,
    'payment_method', v_o.payment_method,
    'contact_name', v_o.contact_name,
    'contact_phone', v_o.contact_phone,
    'address_line', v_o.address_line,
    'city', v_o.city,
    'pincode', v_o.pincode,
    'subtotal', v_o.subtotal,
    'discount', v_o.discount,
    'coupon_code', v_o.coupon_code,
    'points_redeemed', v_o.credit_used,
    'delivery_fee', v_o.delivery_fee,
    'total', v_o.total,
    'points_earned', v_earned,
    'points_will_earn', floor(v_o.total / 100),
    'items', coalesce(v_items, '[]'::jsonb),
    'store', jsonb_build_object(
      'name', coalesce(v_store.name, 'Farmers Fresh'),
      'gstin', v_store.gstin,
      'address', v_store.business_address,
      'support_phone', v_store.support_phone
    )
  );
end $_$;


--
-- Name: get_product_reviews(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_reviews(p_product uuid, p_limit integer DEFAULT 20) RETURNS TABLE(author_name text, rating integer, body text, verified boolean, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.author_name, r.rating, r.body, r.verified, r.created_at
  from public.reviews r
  where r.product_id = p_product and r.is_published
  order by r.verified desc, r.created_at desc
  limit p_limit;
$$;


--
-- Name: get_purchase_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_purchase_order(p_po uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when po.id is null then null else jsonb_build_object(
    'id', po.id, 'po_number', po.po_number, 'status', po.status,
    'supplier_id', po.supplier_id, 'supplier', s.name, 'notes', po.notes,
    'location_id', po.location_id,
    'ordered_at', po.ordered_at, 'received_at', po.received_at, 'created_at', po.created_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'product_name', i.product_name,
        'qty_ordered', i.qty_ordered, 'unit_cost', i.unit_cost, 'qty_received', i.qty_received
      ) order by i.created_at), '[]'::jsonb)
      from public.purchase_order_items i where i.po_id = po.id)
  ) end
  from public.purchase_orders po
  left join public.suppliers s on s.id = po.supplier_id
  where po.id = p_po and po.org_id = public.current_org_id();
$$;


--
-- Name: get_recipe(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recipe(p_id uuid, p_servings integer DEFAULT 4) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; v_items jsonb; v_scale numeric;
begin
  select * into r from public.recipes
   where id = p_id and org_id = public.storefront_org_id() and is_published;
  if r.id is null then return null; end if;
  v_scale := greatest(p_servings,1)::numeric / r.servings;

  select jsonb_agg(jsonb_build_object(
    'product_id', p.id, 'slug', p.slug, 'name', p.name, 'unit', p.unit,
    'price', p.sale_price, 'image_path', p.image_path, 'pack_size', p.pack_size,
    'qty', round(ri.qty * v_scale, 3),
    'line_cost', round(p.sale_price * ri.qty * v_scale, 2)
  ) order by p.name)
  into v_items
  from public.recipe_items ri join public.products p on p.id = ri.product_id
  where ri.recipe_id = r.id and p.is_active and p.sale_price is not null;

  return jsonb_build_object('id', r.id, 'name', r.name, 'cuisine', r.cuisine,
    'is_diet', r.is_diet, 'servings', r.servings, 'description', r.description,
    'image_path', r.image_path, 'video_url', r.video_url,
    'items', coalesce(v_items,'[]'::jsonb));
end $$;


--
-- Name: get_recipe_cuisines(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recipe_cuisines() RETURNS TABLE(cuisine text, n integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select cuisine, count(*)::int from public.recipes
   where org_id = public.storefront_org_id() and is_published
   group by cuisine order by cuisine;
$$;


--
-- Name: get_recipes(text, text, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recipes(p_cuisine text DEFAULT NULL::text, p_diet text DEFAULT NULL::text, p_servings integer DEFAULT 4, p_max_budget numeric DEFAULT NULL::numeric) RETURNS TABLE(id uuid, name text, cuisine text, is_diet boolean, servings integer, image_path text, cost numeric, ingredient_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.id, r.name, r.cuisine, r.is_diet, r.servings, r.image_path,
         round(coalesce(sum(pr.sale_price * ri.qty),0) * greatest(p_servings,1) / r.servings, 2) as cost,
         count(ri.id)::int as ingredient_count
  from public.recipes r
  join public.recipe_items ri on ri.recipe_id = r.id
  join public.products pr on pr.id = ri.product_id and pr.is_active and pr.sale_price is not null
  where r.org_id = public.storefront_org_id() and r.is_published
    and (p_cuisine is null or r.cuisine = p_cuisine)
    and (p_diet is null or (p_diet = 'diet') = r.is_diet)
  group by r.id
  having (p_max_budget is null
          or round(sum(pr.sale_price * ri.qty) * greatest(p_servings,1) / r.servings, 2) <= p_max_budget)
  order by cost;
$$;


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_number text NOT NULL,
    user_id uuid,
    reason text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    refund_points numeric(12,2) DEFAULT 0 NOT NULL,
    staff_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT returns_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: get_returns(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_returns(p_all boolean DEFAULT false) RETURNS SETOF public.returns
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select * from public.returns
   where org_id = public.current_org_id()
     and (p_all or status = 'requested')
   order by created_at desc
   limit 200;
$$;


--
-- Name: get_store_admin_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_store_admin_settings() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; o record;
begin
  perform public.require_permission('settings.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into o from public.organizations where id = v_org;
  return jsonb_build_object(
    'name', o.name,
    'support_email', o.support_email, 'support_phone', o.support_phone,
    'notify_email', o.notify_email, 'notify_phone', o.notify_phone,
    'free_delivery_threshold', o.free_delivery_threshold, 'delivery_fee', o.delivery_fee,
    'gstin', o.gstin, 'business_address', o.business_address,
    'max_discount_percent', o.max_discount_percent,
    'subscription_discount_percent', o.subscription_discount_percent
  );
end $$;


--
-- Name: get_store_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_store_settings() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare o record;
begin
  select * into o from public.organizations where id = public.storefront_org_id();
  if o.id is null then return null; end if;
  return jsonb_build_object(
    'name', o.name,
    'support_email', o.support_email,
    'support_phone', o.support_phone,
    'free_delivery_threshold', o.free_delivery_threshold,
    'delivery_fee', o.delivery_fee,
    'gstin', o.gstin,
    'business_address', o.business_address
  );
end $$;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    order_number text,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    staff_reply text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))
);


--
-- Name: get_support_tickets(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_support_tickets(p_all boolean DEFAULT false) RETURNS SETOF public.support_tickets
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select * from public.support_tickets
   where org_id = public.current_org_id() and (p_all or status = 'open')
   order by created_at desc limit 200;
$$;


--
-- Name: grant_personal_coupon(text, text, numeric, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_personal_coupon(p_phone text, p_kind text, p_value numeric, p_min numeric DEFAULT 0, p_days integer DEFAULT 30, p_max numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_uid uuid; v_code text; v_phone10 text;
begin
  perform public.require_permission('coupons.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if lower(coalesce(p_kind,'')) not in ('percent','flat') then
    return jsonb_build_object('ok', false, 'message', 'Type must be percent or flat.');
  end if;
  if not (coalesce(p_value,0) > 0) then
    return jsonb_build_object('ok', false, 'message', 'Enter a value above zero.');
  end if;

  v_phone10 := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10);
  select o.user_id into v_uid from public.orders o
   where o.org_id = v_org and right(o.contact_phone,10) = v_phone10 and o.user_id is not null
   order by o.placed_at desc limit 1;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'No account found for that number.');
  end if;

  v_code := 'FF' || upper(substr(md5(random()::text), 1, 6));
  insert into public.coupons (org_id, code, kind, value, max_discount, min_subtotal,
                              usage_limit, per_phone_limit, expires_at, is_active, user_id)
  values (v_org, v_code, lower(p_kind), p_value, p_max, greatest(coalesce(p_min,0),0),
          1, 1, now() + make_interval(days => greatest(coalesce(p_days,30),1)), true, v_uid);
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;


--
-- Name: has_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_location(loc uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_org_owner()
      or exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.location_id = loc
      );
$$;


--
-- Name: has_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(p_capability text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_org_owner()
      or exists (
        select 1
        from public.memberships m
        join public.role_capabilities rc on rc.role = m.role
        where m.user_id = auth.uid()
          and m.org_id = public.current_org_id()
          and rc.capability = p_capability
      );
$$;


--
-- Name: hash_card_uid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_card_uid(p_uid text) RETURNS bytea
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  select digest(
    coalesce(current_setting('app.card_salt', true), 'farmersfresh-dev-salt') || p_uid,
    'sha256'
  );
$$;


--
-- Name: in_stock_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.in_stock_products(p_org uuid) RETURNS TABLE(product_id uuid, department text, sort_order integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, coalesce(parent.slug, c.slug), p.sort_order
  from public.products p
  join public.organizations o on o.id = p.org_id
  join public.categories c on c.id = p.category_id
  left join public.categories parent on parent.id = c.parent_id
  left join (
    select product_id, location_id, sum(delta) as qty
    from public.stock_movements group by product_id, location_id
  ) soh on soh.product_id = p.id and soh.location_id = o.storefront_location_id
  where p.org_id = p_org and p.is_published and p.is_active
    and coalesce(soh.qty,0) >= p.min_order_qty;
$$;


--
-- Name: instant_refund(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.instant_refund(p_order_id uuid, p_points numeric, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_o record;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_o from public.orders where id = p_order_id and org_id = v_org;
  if v_o.id is null then raise exception 'Order not found.'; end if;
  if v_o.user_id is null then return jsonb_build_object('ok', false, 'message', 'This order has no account to refund points to.'); end if;
  if not (coalesce(p_points,0) > 0) then return jsonb_build_object('ok', false, 'message', 'Enter an amount.'); end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_o.user_id, p_points, 'refund', v_o.order_number);
  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), 'order.refunded', 'order', p_order_id,
          jsonb_build_object('points', p_points, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;


--
-- Name: is_org_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: is_storefront_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_storefront_org(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org and o.storefront_enabled
  );
$$;


--
-- Name: issue_gift_card(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_gift_card(p_value numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_code text;
begin
  perform public.require_permission('coupons.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not (coalesce(p_value,0) > 0) then return jsonb_build_object('ok', false, 'message', 'Enter a value.'); end if;
  v_code := 'GC' || upper(substr(md5(random()::text), 1, 8));
  insert into public.gift_cards (org_id, code, value) values (v_org, v_code, round(p_value,2));
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;


--
-- Name: list_purchase_orders(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_purchase_orders(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', po.id, 'po_number', po.po_number, 'status', po.status,
      'supplier', s.name, 'notes', po.notes,
      'ordered_at', po.ordered_at, 'received_at', po.received_at, 'created_at', po.created_at,
      'item_count', (select count(*) from public.purchase_order_items i where i.po_id = po.id),
      'total_cost', (select coalesce(sum(i.qty_ordered * i.unit_cost),0)
                     from public.purchase_order_items i where i.po_id = po.id)
    ) as row, po.created_at
    from public.purchase_orders po
    left join public.suppliers s on s.id = po.supplier_id
    where po.org_id = public.current_org_id()
      and (p_status is null or po.status = p_status)
    order by po.created_at desc
    limit greatest(coalesce(p_limit,50),1)
  ) t;
$$;


--
-- Name: list_suppliers(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_suppliers(p_include_inactive boolean DEFAULT false) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'contact_name', s.contact_name,
    'phone', s.phone, 'email', s.email, 'address', s.address,
    'notes', s.notes, 'is_active', s.is_active
  ) order by s.name), '[]'::jsonb)
  from public.suppliers s
  where s.org_id = public.current_org_id()
    and (p_include_inactive or s.is_active);
$$;


--
-- Name: list_wastage(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_wastage(p_days integer DEFAULT 30, p_limit integer DEFAULT 100) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'product_name', w.product_name, 'quantity', w.quantity,
    'reason', w.reason, 'value', round(w.quantity * w.unit_cost, 2),
    'note', w.note, 'created_at', w.created_at
  ) order by w.created_at desc), '[]'::jsonb)
  from public.wastage_log w
  where w.org_id = public.current_org_id()
    and w.created_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1));
$$;


--
-- Name: log_temperature(uuid, text, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_temperature(p_location uuid, p_area text, p_temp numeric, p_min numeric DEFAULT NULL::numeric, p_max numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_breach boolean;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that location.';
  end if;
  if nullif(trim(coalesce(p_area,'')),'') is null then raise exception 'Pick an area.'; end if;
  if p_temp is null then raise exception 'Enter a temperature.'; end if;

  v_breach := (p_min is not null and p_temp < p_min) or (p_max is not null and p_temp > p_max);

  insert into public.cold_chain_logs
    (org_id, location_id, area, temp_c, target_min, target_max, breach, note, actor_id)
  values (v_org, p_location, trim(p_area), p_temp, p_min, p_max, v_breach,
          nullif(trim(coalesce(p_note,'')),''), auth.uid());

  if v_breach then
    insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
    values (v_org, p_location, auth.uid(), 'coldchain.breach', 'location', p_location,
            jsonb_build_object('area', trim(p_area), 'temp', p_temp, 'min', p_min, 'max', p_max));
  end if;
  return v_breach;
end $$;


--
-- Name: log_wastage(uuid, uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_wastage(p_location uuid, p_product uuid, p_qty numeric, p_reason text, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_name text; v_cost numeric; v_on_hand numeric; v_id uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that location.';
  end if;
  if p_reason not in ('spoilage','expiry','damage','theft','count_adjustment','other') then
    raise exception 'Pick a valid reason.';
  end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  select name, last_cost into v_name, v_cost from public.products where id = p_product and org_id = v_org;
  if v_name is null then raise exception 'Product not found.'; end if;

  v_on_hand := public.stock_available(p_location, p_product);
  if v_on_hand - p_qty < 0 then
    raise exception 'That would take stock below zero (on hand: %).', v_on_hand;
  end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, actor_id, note)
  values (v_org, p_location, p_product, -p_qty, 'waste', 'wastage', auth.uid(),
          p_reason || coalesce(' — ' || nullif(trim(coalesce(p_note,'')),''), ''));

  insert into public.wastage_log
    (org_id, location_id, product_id, product_name, quantity, reason, unit_cost, note, actor_id)
  values (v_org, p_location, p_product, v_name, p_qty, p_reason, coalesce(v_cost,0),
          nullif(trim(coalesce(p_note,'')),''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;


--
-- Name: margin_by_product(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.margin_by_product(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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
      and o.placed_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
    group by p.id, p.name, p.sale_price, p.last_cost order by revenue desc limit 100
  ) t;
$$;


--
-- Name: mark_order_paid(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_order_paid(p_order_id uuid, p_razorpay_order text, p_razorpay_payment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_o record; v_notify_email text; v_notify_phone text; v_items text;
begin
  select * into v_o from public.orders where id = p_order_id for update;  -- LOCK
  if v_o.id is null then raise exception 'Order not found.'; end if;
  v_org := v_o.org_id;

  if v_o.is_paid then return; end if;  -- idempotent (duplicate webhook/verify)

  -- Payment landed AFTER the stale-cleaner already cancelled + released stock.
  -- Record the money as received, but do NOT silently re-open the order or
  -- re-reserve stock; flag it for reconciliation (refund or manual re-fulfil).
  if v_o.status = 'cancelled' then
    update public.orders
       set is_paid = true, razorpay_order_id = p_razorpay_order,
           razorpay_payment_id = p_razorpay_payment, paid_at = now()
     where id = p_order_id;
    insert into public.events (org_id, event_type, entity_type, entity_id, payload)
    values (v_org, 'order.paid_after_cancel', 'order', p_order_id,
            jsonb_build_object('razorpay_payment', p_razorpay_payment,
                               'note', 'Paid after cancellation — needs reconciliation'));
    return;
  end if;

  update public.orders
     set is_paid = true, razorpay_order_id = p_razorpay_order,
         razorpay_payment_id = p_razorpay_payment, paid_at = now(),
         status = case when status = 'pending_payment' then 'placed' else status end
   where id = p_order_id;

  insert into public.events (org_id, event_type, entity_type, entity_id, payload)
  values (v_org, 'order.paid', 'order', p_order_id,
          jsonb_build_object('razorpay_payment', p_razorpay_payment));

  select o.notify_email, o.notify_phone into v_notify_email, v_notify_phone
    from public.organizations o where o.id = v_org;
  select string_agg(oi.product_name || ' × ' || oi.quantity, ', ')
    into v_items from public.order_items oi where oi.order_id = p_order_id;

  if v_notify_email is not null then
    insert into public.notifications (org_id, channel, recipient, template, payload)
    values (v_org, 'email', v_notify_email, 'order.placed.staff',
            jsonb_build_object('order_number', v_o.order_number, 'name', v_o.contact_name,
                               'phone', v_o.contact_phone, 'address', v_o.address_line,
                               'pincode', v_o.pincode, 'items', v_items,
                               'total', v_o.total, 'slot', v_o.delivery_slot, 'paid', true));
  end if;
  if v_notify_phone is not null then
    insert into public.notifications (org_id, channel, recipient, template, payload)
    values (v_org, 'sms', v_notify_phone, 'order.placed.staff',
            jsonb_build_object('order_number', v_o.order_number, 'total', v_o.total, 'items', v_items)),
           (v_org, 'whatsapp', v_notify_phone, 'order.placed.staff',
            jsonb_build_object('order_number', v_o.order_number, 'name', v_o.contact_name,
                               'phone', v_o.contact_phone, 'address', v_o.address_line,
                               'items', v_items, 'total', v_o.total));
  end if;
end $$;


--
-- Name: mark_po_ordered(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_po_ordered(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_status text; v_n int;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft can be marked as ordered.'; end if;
  select count(*) into v_n from public.purchase_order_items where po_id = p_po;
  if v_n = 0 then raise exception 'Add at least one item before ordering.'; end if;
  update public.purchase_orders set status = 'ordered', ordered_at = now(), updated_at = now()
   where id = p_po and org_id = v_org;
end $$;


--
-- Name: my_checkout_prefill(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_checkout_prefill() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text; v_phone text; v_name text; o record;
begin
  select lower(nullif(trim(coalesce(u.email,'')), '')),
         nullif(right(regexp_replace(coalesce(u.phone,''), '\D', '', 'g'), 10), ''),
         nullif(trim(coalesce(u.raw_user_meta_data->>'full_name','')), '')
    into v_email, v_phone, v_name
  from auth.users u where u.id = auth.uid();

  if v_email is null and v_phone is null then
    return null;
  end if;

  -- Most recent order that belongs to this customer, for the delivery details.
  select ord.contact_name, ord.contact_phone, ord.contact_email,
         ord.address_line, ord.city, ord.pincode, ord.landmark
    into o
  from public.orders ord
  where (v_phone is not null and right(ord.contact_phone,10) = v_phone)
     or (v_email is not null and lower(ord.contact_email) = v_email)
  order by ord.placed_at desc
  limit 1;

  return jsonb_build_object(
    'name',   coalesce(o.contact_name, v_name, ''),
    'email',  coalesce(o.contact_email, v_email, ''),
    'phone',  coalesce(o.contact_phone, v_phone, ''),
    'address', coalesce(o.address_line, ''),
    'city',    coalesce(o.city, ''),
    'pincode', coalesce(o.pincode, ''),
    'landmark', coalesce(o.landmark, '')
  );
end $$;


--
-- Name: my_coupons(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_coupons() RETURNS TABLE(code text, kind text, value numeric, max_discount numeric, min_subtotal numeric, expires_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select code, kind, value, max_discount, min_subtotal, expires_at
  from public.coupons
  where user_id = auth.uid() and is_active
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or used_count < usage_limit)
  order by expires_at nulls last, created_at desc;
$$;


--
-- Name: my_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_membership() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; m record;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;
  select mm.expires_at, mm.status, p.name, p.discount_percent
    into m
  from public.pass_memberships mm join public.membership_plans p on p.id = mm.plan_id
  where mm.user_id = v_uid and mm.status = 'active' and mm.expires_at > now()
  order by mm.expires_at desc limit 1;
  if m is null then return null; end if;
  return jsonb_build_object('active', true, 'expires_at', m.expires_at,
                            'plan', m.name, 'discount_percent', m.discount_percent);
end $$;


--
-- Name: my_orders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_orders() RETURNS jsonb
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

  select coalesce(jsonb_agg(o order by o.placed_at desc), '[]'::jsonb) into v_rows
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


--
-- Name: my_reorder_products(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_reorder_products(p_limit integer DEFAULT 12) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me as (
    select nullif(right(regexp_replace(coalesce(u.phone,''), '\D','','g'),10),'') as phone,
           lower(nullif(trim(coalesce(u.email,'')),'')) as email
    from auth.users u where u.id = auth.uid()
  ),
  mine as (
    select distinct oi.product_id, max(o.placed_at) as last_at
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join me on ((me.phone is not null and right(o.contact_phone,10) = me.phone)
             or (me.email is not null and lower(o.contact_email) = me.email))
    where o.status <> 'cancelled'
    group by oi.product_id
  )
  select m.product_id
  from mine m
  join public.in_stock_products(public.storefront_org_id()) s on s.product_id = m.product_id
  order by m.last_at desc
  limit p_limit;
$$;


--
-- Name: my_savings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_savings() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_phone text;
  v_email text;
  v_discount numeric;
  v_free int;
  v_orders int;
begin
  select nullif(right(regexp_replace(coalesce(u.phone,''), '\D', '', 'g'), 10), ''),
         lower(nullif(trim(coalesce(u.email,'')), ''))
    into v_phone, v_email
  from auth.users u where u.id = auth.uid();

  if v_phone is null and v_email is null then
    return jsonb_build_object('total_discount', 0, 'free_deliveries', 0, 'order_count', 0);
  end if;

  select
    coalesce(sum(ord.discount), 0),
    coalesce(sum(case when coalesce(ord.delivery_fee, 0) = 0 then 1 else 0 end), 0),
    count(*)
  into v_discount, v_free, v_orders
  from public.orders ord
  where ord.status <> 'cancelled'
    and (
      (v_phone is not null and right(ord.contact_phone, 10) = v_phone)
      or (v_email is not null and lower(ord.contact_email) = v_email)
    );

  return jsonb_build_object(
    'total_discount', v_discount,
    'free_deliveries', v_free,
    'order_count', v_orders
  );
end $$;


--
-- Name: my_scratch_cards(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_scratch_cards() RETURNS TABLE(id uuid, order_number text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id, order_number from public.scratch_cards
   where user_id = auth.uid() and revealed_at is null
   order by created_at desc;
$$;


--
-- Name: my_shift(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_shift() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(bool_or(on_shift), false) from public.memberships
   where user_id = auth.uid() and org_id = public.current_org_id();
$$;


--
-- Name: my_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_tier() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_spent numeric; v_tier text; v_mult numeric; v_next numeric; v_next_name text;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;
  select coalesce(sum(total),0) into v_spent from public.orders
   where user_id = v_uid and status = 'delivered';
  if v_spent >= 20000 then v_tier:='Platinum'; v_mult:=2.0; v_next:=null; v_next_name:=null;
  elsif v_spent >= 5000 then v_tier:='Gold'; v_mult:=1.5; v_next:=20000; v_next_name:='Platinum';
  else v_tier:='Silver'; v_mult:=1.0; v_next:=5000; v_next_name:='Gold'; end if;
  return jsonb_build_object('tier', v_tier, 'spent', v_spent, 'multiplier', v_mult,
    'next_tier', v_next_name, 'to_next', case when v_next is null then 0 else greatest(v_next - v_spent, 0) end);
end $$;


--
-- Name: my_wallet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_wallet() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_code text; v_bal numeric; v_ref uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;

  select code, referred_by into v_code, v_ref from public.referrals where user_id = v_uid;
  if v_code is null then
    -- Short, human, unique code from the user id.
    v_code := 'FF' || upper(substr(replace(v_uid::text,'-',''), 1, 6));
    insert into public.referrals (user_id, code) values (v_uid, v_code)
    on conflict (user_id) do nothing;
    select code, referred_by into v_code, v_ref from public.referrals where user_id = v_uid;
  end if;

  v_bal := public.wallet_balance(v_uid);
  return jsonb_build_object('balance', v_bal, 'code', v_code, 'referred', v_ref is not null);
end $$;


--
-- Name: next_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_order_number() RETURNS text
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  select 'FF-' || to_char(now(), 'YYMMDD') || '-' ||
         lpad((nextval('public.order_number_seq') % 10000)::text, 4, '0');
$$;


--
-- Name: notify_on_restock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_restock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_avail numeric; v_before numeric; v_name text; v_slug text; w record;
begin
  if new.delta is null or new.delta <= 0 then return new; end if;

  v_avail := public.stock_available(new.location_id, new.product_id);
  v_before := v_avail - new.delta;
  if not (v_before <= 0 and v_avail > 0) then return new; end if;

  select name, slug into v_name, v_slug from public.products where id = new.product_id;

  for w in
    select * from public.stock_alerts
     where product_id = new.product_id and notified_at is null
  loop
    if w.email is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (new.org_id, 'email', w.email, 'stock.back.customer',
              jsonb_build_object('product_name', v_name, 'slug', v_slug));
    end if;
    if w.phone is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (new.org_id, 'sms', w.phone, 'stock.back.customer',
              jsonb_build_object('product_name', v_name, 'slug', v_slug)),
             (new.org_id, 'whatsapp', w.phone, 'stock.back.customer',
              jsonb_build_object('product_name', v_name, 'slug', v_slug));
    end if;
    if w.user_id is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (new.org_id, 'push', w.user_id::text, 'stock.back.customer',
              jsonb_build_object('product_name', v_name, 'slug', v_slug));
    end if;
    update public.stock_alerts set notified_at = now() where id = w.id;
  end loop;
  return new;
end $$;


--
-- Name: one_default_address(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.one_default_address() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.is_default then
    update public.customer_addresses
       set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;


--
-- Name: payment_reconciliation(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payment_reconciliation(p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', razorpay_payment_id, 'order_id', razorpay_order_id,
    'amount', amount, 'status', status, 'target', target_type, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from public.payment_events
  where org_id = public.current_org_id()
    and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1));
$$;


--
-- Name: personalized_products(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.personalized_products(p_limit integer DEFAULT 12) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me_cats as (
    select p.category_id, count(*) as c
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.products p on p.id = oi.product_id
    where o.user_id = auth.uid() and o.status <> 'cancelled' and p.category_id is not null
    group by p.category_id
  ),
  bought as (
    select distinct oi.product_id
    from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid()
  )
  select p.id
  from public.products p
  join me_cats mc on mc.category_id = p.category_id
  join public.in_stock_products(public.storefront_org_id()) s on s.product_id = p.id
  where p.is_published and p.is_active
  order by mc.c desc, (p.id in (select product_id from bought)) asc, random()
  limit greatest(coalesce(p_limit, 12), 1);
$$;


--
-- Name: place_order(uuid, text, text, text, text, text, text, text, text, public.cart_line[], text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_order(p_org_id uuid, p_contact_name text, p_contact_phone text, p_address_line text, p_city text, p_pincode text, p_landmark text, p_delivery_slot text, p_notes text, p_lines public.cart_line[], p_contact_email text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_use_credit boolean DEFAULT false, p_payment_method text DEFAULT 'cod'::text) RETURNS TABLE(order_id uuid, order_number text, total numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_order_id uuid; v_number text;
  v_subtotal numeric(12,2) := 0; v_fee numeric(12,2) := 0; v_discount numeric(12,2) := 0;
  v_credit numeric(12,2) := 0;
  v_line public.cart_line; v_count int;
  v_loc uuid; v_on_hand numeric; v_name text;
  v_phone text; v_pin text; v_open int; v_recent int;
  v_notify_email text; v_notify_phone text; v_items text; v_email text;
  v_coupon text; v_prev jsonb; v_uid uuid; v_after_disc numeric(12,2);
  v_method text; v_online boolean; v_status text;
  v_free_over numeric(12,2); v_flat_fee numeric(12,2);
  v_member_pct numeric(5,2); v_member_disc numeric(12,2) := 0;
  v_cap_pct numeric(5,2);
begin
  v_uid := auth.uid();
  if not public.is_storefront_org(p_org_id) then raise exception 'This shop is not open.'; end if;

  v_method := lower(coalesce(nullif(trim(p_payment_method),''),'cod'));
  if v_method not in ('cod','upi_on_delivery','upi','card') then v_method := 'cod'; end if;
  v_online := v_method in ('upi','card');
  v_status := case when v_online then 'pending_payment' else 'placed' end;

  select o.storefront_location_id, o.notify_email, o.notify_phone,
         o.free_delivery_threshold, o.delivery_fee, o.max_discount_percent
    into v_loc, v_notify_email, v_notify_phone, v_free_over, v_flat_fee, v_cap_pct
    from public.organizations o where o.id = p_org_id;
  if v_loc is null then raise exception 'This shop has no delivery store configured.'; end if;

  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') = ''
     or coalesce(trim(p_address_line), '') = '' then
    raise exception 'Name, phone and address are required.';
  end if;

  v_phone := regexp_replace(p_contact_phone, '\s|-|\+91', '', 'g');
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number.'; end if;

  v_email := lower(nullif(trim(coalesce(p_contact_email, '')), ''));
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address doesn''t look right.';
  end if;

  v_pin := regexp_replace(coalesce(p_pincode, ''), '\s', '', 'g');
  if exists (select 1 from public.delivery_zones z where z.org_id = p_org_id and z.is_active) then
    if v_pin = '' then raise exception 'Please add your PIN code so we can check delivery.'; end if;
    if not public.delivers_to(p_org_id, v_pin) then
      raise exception 'Sorry, we don''t deliver to % yet.', v_pin; end if;
  end if;

  select count(*) into v_open from public.orders o
   where o.org_id = p_org_id and o.contact_phone = v_phone
     and o.status not in ('delivered','cancelled','pending_payment');
  if v_open >= 3 then
    raise exception 'You already have % orders on the way. Please wait for those to arrive.', v_open;
  end if;

  select count(*) into v_recent from public.orders o
   where o.org_id = p_org_id and o.contact_phone = v_phone
     and o.placed_at > now() - interval '1 hour';
  if v_recent >= 6 then
    raise exception 'Too many orders from this number in the last hour. Please call us instead.';
  end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then raise exception 'Your basket is empty.'; end if;
  if v_count > 40 then raise exception 'Too many items in one order.'; end if;

  -- Consolidate duplicate product lines so one product is checked/reserved once.
  select array_agg(row(g.product_id, g.qty)::public.cart_line)
    into p_lines
    from (select (x).product_id as product_id, sum((x).quantity) as qty
          from unnest(p_lines) x group by (x).product_id) g;

  -- Reject invalid aggregated quantities BEFORE anything touches stock.
  if exists (
    select 1 from unnest(p_lines) l
    where (l).product_id is null or (l).quantity is null
       or (l).quantity <= 0 or (l).quantity > 50
  ) then
    raise exception 'Invalid product quantity.';
  end if;

  perform 1 from public.stock_movements
   where location_id = v_loc and product_id in (select (l).product_id from unnest(p_lines) l)
   for update;

  foreach v_line in array p_lines loop
    select p.name into v_name from public.products p
     where p.id = v_line.product_id and p.org_id = p_org_id
       and p.is_published and p.is_active and p.sale_price is not null;
    if v_name is null then raise exception 'One of those items is no longer available.'; end if;
    v_on_hand := public.stock_available(v_loc, v_line.product_id);
    if v_on_hand < v_line.quantity then
      if v_on_hand <= 0 then raise exception '% is sold out.', v_name;
      else raise exception 'Only % kg of % left.', v_on_hand, v_name; end if;
    end if;
  end loop;

  v_number := public.next_order_number();

  insert into public.orders (
    org_id, location_id, order_number, contact_name, contact_phone, contact_email,
    address_line, city, pincode, landmark, delivery_slot, notes, user_id,
    payment_method, status
  ) values (
    p_org_id, v_loc, v_number, trim(p_contact_name), v_phone, v_email, trim(p_address_line),
    nullif(trim(coalesce(p_city,'')), ''), nullif(v_pin, ''),
    nullif(trim(coalesce(p_landmark,'')), ''), nullif(trim(coalesce(p_delivery_slot,'')), ''),
    nullif(trim(coalesce(p_notes,'')), ''), v_uid, v_method, v_status
  ) returning orders.id into v_order_id;

  foreach v_line in array p_lines loop
    insert into public.order_items (order_id, product_id, product_name, unit, quantity, unit_price)
    select v_order_id, p.id, p.name, p.unit, v_line.quantity, p.sale_price
    from public.products p
    where p.id = v_line.product_id and p.org_id = p_org_id
      and p.is_published and p.is_active and p.sale_price is not null
      and v_line.quantity > 0 and v_line.quantity <= 50;

    insert into public.stock_movements (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
    values (p_org_id, v_loc, v_line.product_id, -v_line.quantity, 'order_reserved', 'order', v_order_id, v_number);
  end loop;

  select coalesce(sum(oi.line_total), 0),
         string_agg(oi.product_name || ' × ' || oi.quantity, ', ')
    into v_subtotal, v_items
    from public.order_items oi where oi.order_id = v_order_id;
  if v_subtotal <= 0 then raise exception 'None of those items are available right now.'; end if;

  if coalesce(trim(p_coupon_code),'') <> '' then
    v_prev := public.preview_coupon(p_org_id, p_coupon_code, v_subtotal, v_phone);
    if (v_prev->>'ok')::boolean is not true then
      raise exception '%', coalesce(v_prev->>'message', 'That code isn''t valid.');
    end if;
    v_discount := coalesce((v_prev->>'discount')::numeric, 0);
    v_coupon := v_prev->>'code';
    update public.coupons set used_count = used_count + 1
      where org_id = p_org_id and upper(code) = upper(v_coupon)
        and (usage_limit is null or used_count < usage_limit);
    if not found then raise exception 'Sorry — that code was just fully used.'; end if;
  end if;

  if v_uid is not null then
    select p.discount_percent into v_member_pct
    from public.pass_memberships m join public.membership_plans p on p.id = m.plan_id
    where m.user_id = v_uid and m.org_id = p_org_id
      and m.status = 'active' and m.expires_at > now()
    order by m.expires_at desc limit 1;
  end if;
  if v_member_pct is not null and v_member_pct > 0 then
    v_member_disc := round(v_subtotal * v_member_pct / 100.0, 2);
    v_discount := v_discount + v_member_disc;
  end if;

  if coalesce(v_cap_pct, 100) < 100 then
    v_discount := least(v_discount, round(v_subtotal * v_cap_pct / 100.0, 2));
  end if;

  v_after_disc := greatest(v_subtotal - v_discount, 0);

  if p_use_credit and v_uid is not null then
    v_credit := least(public.wallet_balance(v_uid), v_after_disc);
    if v_credit > 0 then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (p_org_id, v_uid, -v_credit, 'redeemed', v_number);
    end if;
  end if;

  v_fee := case when v_member_pct is not null then 0
                when v_subtotal >= coalesce(v_free_over, 500) then 0
                else coalesce(v_flat_fee, 40) end;

  update public.orders o
     set subtotal = v_subtotal, delivery_fee = v_fee, discount = v_discount,
         coupon_code = v_coupon, credit_used = v_credit,
         total = greatest(v_after_disc - v_credit, 0) + v_fee
   where o.id = v_order_id;

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (p_org_id, v_loc, 'order.placed', 'order', v_order_id,
          jsonb_build_object('order_number', v_number, 'total', greatest(v_after_disc - v_credit,0) + v_fee,
                             'discount', v_discount, 'coupon', v_coupon, 'credit', v_credit,
                             'payment_method', v_method, 'held', v_online,
                             'member_discount', v_member_disc));

  if not v_online then
    if v_notify_email is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (p_org_id, 'email', v_notify_email, 'order.placed.staff',
              jsonb_build_object('order_number', v_number, 'name', trim(p_contact_name),
                                 'phone', v_phone, 'address', trim(p_address_line),
                                 'pincode', v_pin, 'items', v_items,
                                 'total', greatest(v_after_disc - v_credit,0) + v_fee, 'slot', p_delivery_slot));
    end if;
    if v_notify_phone is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (p_org_id, 'sms', v_notify_phone, 'order.placed.staff',
              jsonb_build_object('order_number', v_number, 'total', greatest(v_after_disc - v_credit,0) + v_fee, 'items', v_items)),
             (p_org_id, 'whatsapp', v_notify_phone, 'order.placed.staff',
              jsonb_build_object('order_number', v_number, 'name', trim(p_contact_name),
                                 'phone', v_phone, 'address', trim(p_address_line),
                                 'items', v_items, 'total', greatest(v_after_disc - v_credit,0) + v_fee));
    end if;
  end if;

  return query select v_order_id, v_number, (greatest(v_after_disc - v_credit,0) + v_fee)::numeric;
end $_$;


--
-- Name: pos_loyalty_lookup(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pos_loyalty_lookup(p_code text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_uid uuid; v_name text; v_pts numeric;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in to a till.'; end if;

  select user_id into v_uid from public.referrals
   where upper(code) = upper(trim(coalesce(p_code,'')));
  if v_uid is null then return jsonb_build_object('found', false); end if;

  -- A friendly name: their most recent order, else their account name.
  select o.contact_name into v_name from public.orders o
   where o.user_id = v_uid order by o.placed_at desc limit 1;
  if v_name is null then
    select nullif(trim(coalesce(u.raw_user_meta_data->>'full_name','')),'')
      into v_name from auth.users u where u.id = v_uid;
  end if;

  v_pts := public.wallet_balance(v_uid);
  return jsonb_build_object('found', true, 'user_id', v_uid,
                            'name', coalesce(v_name, 'Member'), 'points', v_pts);
end $$;


--
-- Name: preview_coupon(uuid, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_coupon(p_org uuid, p_code text, p_subtotal numeric, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare c record; v_disc numeric(12,2); v_phone text; v_used int;
begin
  if coalesce(trim(p_code),'') = '' then return jsonb_build_object('ok', false, 'message', 'Enter a code.'); end if;

  select * into c from public.coupons
   where org_id = p_org and upper(code) = upper(trim(p_code)) and is_active;
  if c.id is null then return jsonb_build_object('ok', false, 'message', 'That code isn''t valid.'); end if;

  -- Personal coupon: only its owner may use it.
  if c.user_id is not null and c.user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'That code isn''t valid.');
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('ok', false, 'message', 'This code isn''t active yet.'); end if;
  if c.expires_at is not null and now() > c.expires_at then
    return jsonb_build_object('ok', false, 'message', 'This code has expired.'); end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('ok', false, 'message', 'This code has been fully used.'); end if;
  if coalesce(p_subtotal,0) < c.min_subtotal then
    return jsonb_build_object('ok', false,
      'message', 'Spend at least ' || c.min_subtotal || ' to use this code.'); end if;

  v_phone := regexp_replace(coalesce(p_phone,''), '\s|-|\+91', '', 'g');
  if v_phone ~ '^[6-9][0-9]{9}$' then
    select count(*) into v_used from public.orders o
      where o.org_id = p_org and o.contact_phone = v_phone
        and upper(o.coupon_code) = upper(trim(p_code)) and o.status <> 'cancelled';
    if v_used >= c.per_phone_limit then
      return jsonb_build_object('ok', false, 'message', 'You''ve already used this code.'); end if;
  end if;

  if c.kind = 'percent' then
    v_disc := round(p_subtotal * c.value / 100.0, 2);
    if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  else
    v_disc := c.value;
  end if;
  v_disc := least(v_disc, p_subtotal);

  return jsonb_build_object('ok', true, 'code', upper(trim(p_code)),
                            'discount', v_disc, 'message', 'Code applied');
end $_$;


--
-- Name: price_check(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.price_check(p_threshold numeric DEFAULT 10) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: procurement_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.procurement_overview() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'open_pos', (select count(*) from public.purchase_orders
                 where org_id = public.current_org_id() and status in ('draft','ordered')),
    'suppliers', (select count(*) from public.suppliers
                  where org_id = public.current_org_id() and is_active),
    'wastage_value_30d', (select coalesce(round(sum(quantity*unit_cost),2),0)
                          from public.wastage_log
                          where org_id = public.current_org_id()
                            and created_at >= now() - interval '30 days')
  );
$$;


--
-- Name: product_department(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.product_department(p_product uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(parent.slug, c.slug)
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.categories parent on parent.id = c.parent_id
  where p.id = p_product;
$$;


--
-- Name: product_ratings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.product_ratings() RETURNS TABLE(product_id uuid, avg_rating numeric, review_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.product_id, round(avg(r.rating), 1), count(*)
  from public.reviews r
  join public.organizations o on o.id = r.org_id
  where r.is_published and o.storefront_enabled
  group by r.product_id;
$$;


--
-- Name: rate_delivery(text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rate_delivery(p_number text, p_phone text, p_rating integer, p_comment text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_uid uuid; v_phone text; v_o record;
begin
  v_uid := auth.uid();
  v_phone := regexp_replace(coalesce(p_phone,''), '\s|-|\+91', '', 'g');
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'message', 'Pick 1 to 5 stars.');
  end if;

  select * into v_o from public.orders where upper(order_number) = upper(trim(coalesce(p_number,'')));
  if v_o.id is null then return jsonb_build_object('ok', false, 'message', 'Order not found.'); end if;
  if not ((v_uid is not null and v_o.user_id = v_uid)
          or (v_phone ~ '^[6-9][0-9]{9}$' and v_o.contact_phone = v_phone)) then
    return jsonb_build_object('ok', false, 'message', 'We couldn''t match that order.');
  end if;
  if v_o.status <> 'delivered' then
    return jsonb_build_object('ok', false, 'message', 'You can rate once it''s delivered.');
  end if;
  if v_o.delivery_rating is not null then
    return jsonb_build_object('ok', true, 'message', 'Thanks — you already rated this delivery.');
  end if;

  update public.orders
     set delivery_rating = p_rating,
         delivery_comment = nullif(trim(coalesce(p_comment,'')),''), rated_at = now()
   where id = v_o.id;
  return jsonb_build_object('ok', true, 'message', 'Thanks for the feedback!');
end $_$;


--
-- Name: recalc_sale_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalc_sale_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_sale uuid;
  v_total numeric(12,2);
  v_paid  numeric(12,2);
begin
  v_sale := coalesce(new.sale_id, old.sale_id);
  if v_sale is null then
    return coalesce(new, old);
  end if;

  select total into v_total from public.sales where id = v_sale;
  select coalesce(sum(amount), 0) into v_paid from public.payments where sale_id = v_sale;

  update public.sales
     set amount_paid    = v_paid,
         payment_status = case
                            when v_paid >= v_total then 'paid'
                            when v_paid > 0        then 'partial'
                            else 'credit'
                          end,
         updated_at     = now()
   where id = v_sale;

  return coalesce(new, old);
end $$;


--
-- Name: recall_trace(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recall_trace(p_product uuid, p_from date, p_to date) RETURNS TABLE(order_number text, contact_name text, contact_phone text, placed_at timestamp with time zone, status text, quantity numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.order_number, o.contact_name, o.contact_phone, o.placed_at, o.status, oi.quantity
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.org_id = public.current_org_id()
    and oi.product_id = p_product
    and o.status <> 'cancelled'
    and o.placed_at >= coalesce(p_from, '1900-01-01'::date)
    and o.placed_at < coalesce(p_to, '2999-01-01'::date) + interval '1 day'
  order by o.placed_at desc
  limit 500;
$$;


--
-- Name: receive_purchase_order(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_purchase_order(p_po uuid, p_items jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org uuid; v_loc uuid; v_status text; v_supplier uuid; v_number text;
  el jsonb; v_item record; v_qty numeric; v_expiry date; v_batch uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status, location_id, supplier_id, po_number
    into v_status, v_loc, v_supplier, v_number
    from public.purchase_orders where id = p_po and org_id = v_org for update;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if v_status not in ('draft','ordered') then
    raise exception 'This order has already been received or cancelled.';
  end if;

  for el in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_qty := coalesce((el->>'qty')::numeric, 0);
    if v_qty <= 0 then continue; end if;
    select * into v_item from public.purchase_order_items
     where id = (el->>'item_id')::uuid and po_id = p_po and org_id = v_org;
    if v_item.id is null then continue; end if;

    v_expiry := null;
    if coalesce(el->>'expiry','') <> '' then
      begin v_expiry := (el->>'expiry')::date; exception when others then v_expiry := null; end;
    end if;

    -- One lot per received line. remaining starts 0; the stamped movement's
    -- trigger raises it to v_qty (single source of truth for remaining).
    insert into public.product_batches (
      org_id, location_id, product_id, batch_code, source, po_id, supplier_id,
      received_qty, remaining_qty, quantity, unit_cost, source_date, expiry_date, status, created_by
    ) values (
      v_org, v_loc, v_item.product_id,
      'B-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
        lpad(nextval('public.batch_code_seq')::text, 4, '0'),
      'purchase', p_po, v_supplier,
      v_qty, 0, v_qty, v_item.unit_cost,
      (now() at time zone 'Asia/Kolkata')::date, v_expiry, 'active', auth.uid()
    ) returning id into v_batch;

    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note, batch_id)
    values (v_org, v_loc, v_item.product_id, v_qty, 'purchase', 'purchase_order', p_po, auth.uid(),
            'Received on ' || v_number, v_batch);

    update public.purchase_order_items set qty_received = v_qty where id = v_item.id;
    update public.products set last_cost = v_item.unit_cost, updated_at = now()
      where id = v_item.product_id and org_id = v_org;
  end loop;

  update public.purchase_orders set status = 'received', received_at = now(), updated_at = now()
    where id = p_po and org_id = v_org;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, auth.uid(), 'purchase.received', 'purchase_order', p_po,
          jsonb_build_object('po', p_po));
end $$;


--
-- Name: recent_temperature(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recent_temperature(p_days integer DEFAULT 7, p_limit integer DEFAULT 100) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'breaches', (select count(*) from public.cold_chain_logs
                 where org_id = public.current_org_id() and breach
                   and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1))),
    'readings', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'area', c.area, 'temp_c', c.temp_c,
        'target_min', c.target_min, 'target_max', c.target_max,
        'breach', c.breach, 'note', c.note, 'created_at', c.created_at
      ) order by c.created_at desc), '[]'::jsonb)
      from (
        select * from public.cold_chain_logs
        where org_id = public.current_org_id()
          and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1))
        order by created_at desc
        limit greatest(coalesce(p_limit,100),1)
      ) c)
  );
$$;


--
-- Name: record_account_payment(uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_account_payment(p_customer_id uuid, p_amount numeric, p_method text DEFAULT 'cash'::text, p_note text DEFAULT NULL::text) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_loc uuid; v_outstanding numeric;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;

  -- The customer must be in the caller's org and reachable by them.
  select location_id into v_loc from public.customers
   where id = p_customer_id and org_id = v_org;
  if v_loc is null then raise exception 'Customer not found.'; end if;
  if not public.has_location(v_loc) then
    raise exception 'You do not have access to that customer.';
  end if;

  insert into public.payments
    (org_id, location_id, sale_id, customer_id, amount, method, created_by)
  values (v_org, v_loc, null, p_customer_id, p_amount, coalesce(p_method,'cash'), auth.uid());

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, auth.uid(), 'payment.received', 'customer', p_customer_id,
          jsonb_build_object('amount', p_amount, 'method', p_method, 'note', p_note));

  select outstanding into v_outstanding
  from public.customer_balances where customer_id = p_customer_id;

  return coalesce(v_outstanding, 0);
end $$;


--
-- Name: record_production(uuid, uuid, numeric, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_production(p_location uuid, p_product uuid, p_qty numeric, p_expiry date DEFAULT NULL::date, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_cost numeric; v_name text; v_batch uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then raise exception 'No access to that location.'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  select last_cost, name into v_cost, v_name from public.products where id = p_product and org_id = v_org;
  if v_name is null then raise exception 'Product not found.'; end if;

  insert into public.product_batches (
    org_id, location_id, product_id, batch_code, source,
    received_qty, remaining_qty, quantity, unit_cost, source_date, expiry_date, status, created_by
  ) values (
    v_org, p_location, p_product,
    'B-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
      lpad(nextval('public.batch_code_seq')::text,4,'0'),
    'production', p_qty, 0, p_qty, coalesce(v_cost,0),
    (now() at time zone 'Asia/Kolkata')::date, p_expiry, 'active', auth.uid()
  ) returning id into v_batch;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, actor_id, note, batch_id)
  values (v_org, p_location, p_product, p_qty, 'production', 'production', auth.uid(),
          nullif(trim(coalesce(p_note,'')),''), v_batch);
  return v_batch;
end $$;


--
-- Name: record_sale(uuid, uuid, public.sale_line[], text, numeric, text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_sale(p_location uuid, p_customer_id uuid, p_lines public.sale_line[], p_method text, p_amount_paid numeric, p_note text DEFAULT NULL::text, p_loyalty_user uuid DEFAULT NULL::uuid, p_points_redeem numeric DEFAULT 0) RETURNS TABLE(sale_id uuid, total numeric, change numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org uuid; v_sale uuid; v_line public.sale_line;
  v_total numeric(12,2) := 0; v_count int; v_pay numeric(12,2);
  v_name text; v_redeem numeric(12,2) := 0; v_earn numeric(12,2) := 0;
  v_owed numeric(12,2);
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that till.';
  end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then raise exception 'Nothing to sell — the cart is empty.'; end if;

  insert into public.sales (org_id, location_id, customer_id, total, created_by)
  values (v_org, p_location, p_customer_id, 0, auth.uid())
  returning id into v_sale;

  perform 1 from public.stock_movements
   where location_id = p_location
     and product_id in (select (l).product_id from unnest(p_lines) l)
   for update;

  foreach v_line in array p_lines loop
    select p.name into v_name from public.products p
     where p.id = v_line.product_id and p.org_id = v_org and p.is_active;
    if v_name is null then raise exception 'One of those items is not for sale.'; end if;
    if v_line.quantity <= 0 then raise exception 'Quantity must be more than zero.'; end if;
    if v_line.unit_price < 0 then raise exception 'Price cannot be negative.'; end if;
    if public.stock_available(p_location, v_line.product_id) < v_line.quantity then
      raise exception '% is out of stock.', v_name;
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale, v_line.product_id, v_line.quantity, v_line.unit_price);

    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note)
    values (v_org, p_location, v_line.product_id, -v_line.quantity,
            'sale', 'sale', v_sale, auth.uid(), 'Counter sale');
  end loop;

  select coalesce(sum(si.line_total), 0) into v_total
  from public.sale_items si where si.sale_id = v_sale;

  update public.sales s set total = v_total where s.id = v_sale;

  -- Redeem loyalty points as a tender (1 point = ₹1), capped at the balance
  -- and the sale total. Debits the points ledger.
  if p_loyalty_user is not null and coalesce(p_points_redeem,0) > 0 then
    v_redeem := least(floor(p_points_redeem), public.wallet_balance(p_loyalty_user), v_total);
    if v_redeem > 0 then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (v_org, p_loyalty_user, -v_redeem, 'redeemed', 'SALE:' || v_sale::text);
    end if;
  end if;

  v_owed := v_total - v_redeem;

  -- A part-paid/credit sale still needs a named credit customer to chase.
  if p_customer_id is null and coalesce(p_amount_paid,0) < v_owed then
    raise exception 'Choose a customer for a credit or part-paid sale.';
  end if;

  -- Bank the money actually taken, up to what's still owed after points.
  v_pay := least(coalesce(p_amount_paid, 0), v_owed);
  if v_pay > 0 then
    insert into public.payments
      (org_id, location_id, sale_id, customer_id, amount, method, created_by)
    values (v_org, p_location, v_sale, p_customer_id, v_pay,
            coalesce(p_method, 'cash'), auth.uid());
  end if;

  -- Earn points on the net amount spent (after any redemption): 1 per ₹100.
  if p_loyalty_user is not null then
    v_earn := floor(v_owed / 100);
    if v_earn > 0 then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (v_org, p_loyalty_user, v_earn, 'points', 'SALE:' || v_sale::text);
    end if;
  end if;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, p_location, auth.uid(), 'sale.created', 'sale', v_sale,
          jsonb_build_object('total', v_total, 'paid', v_pay, 'method', p_method,
                             'customer', p_customer_id, 'note', p_note,
                             'loyalty_user', p_loyalty_user, 'points_redeemed', v_redeem,
                             'points_earned', v_earn));

  return query select v_sale, v_total,
                      greatest(coalesce(p_amount_paid, 0) - v_owed, 0)::numeric;
end $$;


--
-- Name: record_stock(uuid, uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_stock(p_location uuid, p_product uuid, p_delta numeric, p_reason text, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id bigint; v_on_hand numeric;
begin
  perform public.require_permission('inventory.adjust');
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

  -- Stock cannot go negative by hand. If it wants to, the count is wrong and
  -- someone should look, rather than the number quietly going below zero.
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


--
-- Name: redeem_gift_card(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_gift_card(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_org uuid; c record; v_val numeric;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please sign in.'); end if;
  v_org := public.storefront_org_id();

  select * into c from public.gift_cards
   where upper(code) = upper(trim(coalesce(p_code,''))) and org_id = v_org;
  if c.id is null then return jsonb_build_object('ok', false, 'message', 'That gift card code isn''t valid.'); end if;

  update public.gift_cards set redeemed_by = v_uid, redeemed_at = now()
   where id = c.id and redeemed_at is null
   returning value into v_val;
  if not found then return jsonb_build_object('ok', false, 'message', 'This gift card has already been used.'); end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_uid, v_val, 'gift', c.code);
  return jsonb_build_object('ok', true, 'value', v_val);
end $$;


--
-- Name: redeem_referral(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_referral(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_org uuid; v_owner uuid; v_mine record;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in first.'); end if;
  v_org := public.storefront_org_id();

  perform public.my_wallet();
  select * into v_mine from public.referrals where user_id = v_uid;
  if v_mine.referred_by is not null then
    return jsonb_build_object('ok', false, 'message', 'You''ve already used a referral code.');
  end if;

  select user_id into v_owner from public.referrals where upper(code) = upper(trim(p_code));
  if v_owner is null then return jsonb_build_object('ok', false, 'message', 'That code isn''t valid.'); end if;
  if v_owner = v_uid then return jsonb_build_object('ok', false, 'message', 'You can''t use your own code.'); end if;

  -- Atomic: only the first request that sets referred_by gets the reward.
  update public.referrals set referred_by = v_owner
   where user_id = v_uid and referred_by is null;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'You''ve already used a referral code.');
  end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_uid, 50, 'referral_welcome', v_mine.code);
  return jsonb_build_object('ok', true, 'message', '₹50 added to your wallet!');
end $$;


--
-- Name: refill_suggestions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refill_suggestions() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with mine as (
    select oi.product_id, o.placed_at::date as d
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and o.status <> 'cancelled'
  ),
  agg as (
    select product_id,
           count(distinct d) as n,
           max(d) as last_d,
           (max(d) - min(d))::numeric / nullif(count(distinct d) - 1, 0) as avg_gap
    from mine group by product_id
    having count(distinct d) >= 2
  )
  select a.product_id
  from agg a
  join public.in_stock_products(public.storefront_org_id()) s on s.product_id = a.product_id
  where a.avg_gap is not null and a.avg_gap > 0
    and (current_date - a.last_d) >= 0.8 * a.avg_gap
  order by (current_date - a.last_d) - a.avg_gap desc
  limit 12;
$$;


--
-- Name: reject_return(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_return(p_id uuid, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_r record;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_r from public.returns where id = p_id and org_id = v_org;
  if v_r.id is null then raise exception 'Return not found.'; end if;
  if v_r.status <> 'requested' then raise exception 'This request is already resolved.'; end if;

  update public.returns
     set status = 'rejected', staff_note = nullif(trim(coalesce(p_note,'')),''),
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
end $$;


--
-- Name: remind_abandoned_carts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remind_abandoned_carts() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; n int := 0; v_email text; v_phone text;
begin
  for r in
    select c.* from public.saved_carts c
     where c.reminded_at is null
       and c.updated_at < now() - interval '3 hours'
       and c.updated_at > now() - interval '7 days'
  loop
    -- Skip if they ordered after the cart was last touched.
    if exists (
      select 1 from public.orders o
       where o.user_id = r.user_id and o.placed_at > r.updated_at
         and o.status <> 'cancelled'
    ) then
      delete from public.saved_carts where user_id = r.user_id;
      continue;
    end if;

    select lower(nullif(trim(email),'')),
           nullif(right(regexp_replace(coalesce(phone,''),'\D','','g'),10),'')
      into v_email, v_phone
      from auth.users where id = r.user_id;

    if v_email is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (r.org_id, 'email', v_email, 'cart.reminder.customer',
              jsonb_build_object('item_count', r.item_count, 'subtotal', r.subtotal));
    end if;
    insert into public.notifications (org_id, channel, recipient, template, payload)
    values (r.org_id, 'push', r.user_id::text, 'cart.reminder.customer',
            jsonb_build_object('item_count', r.item_count, 'subtotal', r.subtotal));

    update public.saved_carts set reminded_at = now() where user_id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end $$;


--
-- Name: remove_po_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_po_item(p_item uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_status text;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select po.status into v_status
    from public.purchase_order_items i join public.purchase_orders po on po.id = i.po_id
   where i.id = p_item and i.org_id = v_org;
  if v_status is null then raise exception 'Item not found.'; end if;
  if v_status <> 'draft' then raise exception 'You can only change a draft order.'; end if;
  delete from public.purchase_order_items where id = p_item and org_id = v_org;
end $$;


--
-- Name: reorder_suggestions(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_suggestions(p_lookback integer DEFAULT 28, p_horizon integer DEFAULT 7, p_lead integer DEFAULT 2) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with cfg as (
    select public.current_org_id() as org,
           greatest(coalesce(p_lookback,28),1) as lookback,
           greatest(coalesce(p_horizon,7),1) as horizon,
           greatest(coalesce(p_lead,2),0) as lead
  ),
  loc as (
    select storefront_location_id as id from public.organizations, cfg
     where organizations.id = cfg.org
  ),
  demand as (
    select m.product_id, -sum(m.delta) as qty
    from public.stock_movements m, cfg, loc
    where m.org_id = cfg.org
      and m.location_id = loc.id
      and m.reason in ('sale','order_reserved','order_released')
      and m.created_at >= now() - make_interval(days => cfg.lookback)
    group by m.product_id
    having -sum(m.delta) > 0
  ),
  onhand as (
    select m.product_id, sum(m.delta) as qty
    from public.stock_movements m, loc
    where m.location_id = loc.id
    group by m.product_id
  ),
  incoming as (
    select i.product_id, sum(i.qty_ordered - i.qty_received) as qty
    from public.purchase_order_items i
    join public.purchase_orders po on po.id = i.po_id
    where po.status in ('draft','ordered')
    group by i.product_id
  )
  select coalesce(jsonb_agg(row order by cover_days asc nulls first), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'avg_daily', round(d.qty / c.lookback, 3),
      'forecast', round(d.qty / c.lookback * (c.horizon + c.lead), 2),
      'on_hand', round(coalesce(oh.qty,0), 3),
      'incoming', round(coalesce(inc.qty,0), 3),
      'cover_days', case when d.qty > 0
                         then round(coalesce(oh.qty,0) / (d.qty / c.lookback), 1)
                         else null end,
      'suggested_qty', greatest(0,
        round((d.qty / c.lookback * (c.horizon + c.lead))
              - coalesce(oh.qty,0) - coalesce(inc.qty,0), 1)),
      'last_cost', p.last_cost,
      'sale_price', p.sale_price
    ) as row,
    case when d.qty > 0 then coalesce(oh.qty,0) / (d.qty / c.lookback) else null end as cover_days
    from demand d
    join public.products p on p.id = d.product_id and p.is_active
    left join onhand oh on oh.product_id = d.product_id
    left join incoming inc on inc.product_id = d.product_id
    cross join cfg c
  ) t;
$$;


--
-- Name: request_return(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_return(p_number text, p_reason text, p_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_uid uuid; v_phone text; v_o record;
begin
  v_uid := auth.uid();
  v_phone := regexp_replace(coalesce(p_phone,''), '\s|-|\+91', '', 'g');
  if coalesce(trim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'message', 'Please tell us what went wrong.');
  end if;

  select * into v_o from public.orders where upper(order_number) = upper(trim(coalesce(p_number,'')));
  if v_o.id is null then return jsonb_build_object('ok', false, 'message', 'Order not found.'); end if;

  if not ((v_uid is not null and v_o.user_id = v_uid)
          or (v_phone ~ '^[6-9][0-9]{9}$' and v_o.contact_phone = v_phone)) then
    return jsonb_build_object('ok', false, 'message', 'We couldn''t match that order.');
  end if;

  if v_o.status <> 'delivered' then
    return jsonb_build_object('ok', false,
      'message', 'You can raise an issue once the order is delivered.');
  end if;

  if exists (select 1 from public.returns r where r.order_id = v_o.id and r.status = 'requested') then
    return jsonb_build_object('ok', true, 'message', 'We already have your request — we''re on it.');
  end if;

  insert into public.returns (org_id, order_id, order_number, user_id, reason)
  values (v_o.org_id, v_o.id, v_o.order_number, v_o.user_id, left(trim(p_reason), 1000));
  return jsonb_build_object('ok', true, 'message', 'Thanks — we''ve logged it and will get back to you.');
end $_$;


--
-- Name: require_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_permission(p_capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.has_permission(p_capability) then
    raise exception 'Insufficient permissions.' using errcode = '42501';
  end if;
  return true;
end $$;


--
-- Name: resolve_card(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_card(p_uid text) RETURNS TABLE(staff_member_id uuid, full_name text, location_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id, s.full_name, s.location_id
  from public.staff_cards c
  join public.staff_members s on s.id = c.staff_member_id
  where c.card_uid_hash = public.hash_card_uid(p_uid)
    and c.revoked_at is null
    and s.is_active
    and c.org_id = public.current_org_id()
    and public.has_location(s.location_id);
$$;


--
-- Name: resolve_support_ticket(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_support_ticket(p_id uuid, p_reply text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.support_tickets
     set status = 'resolved', staff_reply = nullif(trim(coalesce(p_reply,'')),''), resolved_at = now()
   where id = p_id and org_id = v_org;
  if not found then raise exception 'Ticket not found.'; end if;
end $$;


--
-- Name: retire_product(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retire_product(p_id uuid, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_loc uuid; v_on_hand numeric;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then raise exception 'Only an owner can retire a product.'; end if;
  select storefront_location_id into v_loc from public.organizations where id = v_org;
  if v_loc is not null then
    v_on_hand := public.stock_available(v_loc, p_id);
    if v_on_hand <> 0 then
      insert into public.stock_movements (org_id, location_id, product_id, delta, reason, actor_id, note)
      values (v_org, v_loc, p_id, -v_on_hand, 'adjustment', auth.uid(), coalesce(p_reason, 'Line discontinued'));
    end if;
  end if;
  update public.products set is_published = false, is_active = false where id = p_id and org_id = v_org;
  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), 'product.retired', 'product', p_id, jsonb_build_object('reason', p_reason));
end $$;


--
-- Name: reveal_scratch_card(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reveal_scratch_card(p_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_pts int; v_org uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Please sign in.'; end if;

  update public.scratch_cards set revealed_at = now()
   where id = p_id and user_id = v_uid and revealed_at is null
   returning reward_points, org_id into v_pts, v_org;
  if found then
    insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
    values (v_org, v_uid, v_pts, 'reward', 'SCRATCH:' || p_id::text);
    return v_pts;
  end if;

  -- Already revealed (or not the caller's card): return existing points, no re-credit.
  select reward_points into v_pts from public.scratch_cards where id = p_id and user_id = v_uid;
  if v_pts is null then raise exception 'Card not found.'; end if;
  return v_pts;
end $$;


--
-- Name: revert_markdown(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_markdown(p_product uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; m record;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into m from public.markdowns where product_id = p_product and active and org_id = v_org;
  if m.id is null then return; end if;
  update public.products set sale_price = m.orig_sale_price,
         compare_at_price = m.orig_compare_at, badge = m.orig_badge, updated_at = now()
   where id = p_product;
  update public.markdowns set active = false where id = m.id;
end $$;


--
-- Name: reward_on_delivery(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reward_on_delivery() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_pts numeric(12,2); v_ref record; v_spent numeric; v_mult numeric;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.user_id is not null then

    select coalesce(sum(o.total),0) into v_spent from public.orders o
     where o.user_id = new.user_id and o.status = 'delivered' and o.id <> new.id;
    v_mult := case when v_spent >= 20000 then 2.0 when v_spent >= 5000 then 1.5 else 1.0 end;

    v_pts := floor(new.total / 100 * v_mult);
    if v_pts > 0 and not exists (
      select 1 from public.wallet_ledger
      where user_id = new.user_id and reason = 'points' and ref = new.order_number
    ) then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (new.org_id, new.user_id, v_pts, 'points', new.order_number);
    end if;

    select * into v_ref from public.referrals where user_id = new.user_id;
    if v_ref.referred_by is not null and not v_ref.reward_paid then
      insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
      values (new.org_id, v_ref.referred_by, 50, 'referral_reward', new.order_number);
      update public.referrals set reward_paid = true where user_id = new.user_id;
    end if;

    if not exists (
      select 1 from public.scratch_cards
       where order_number = new.order_number and user_id = new.user_id
    ) then
      insert into public.scratch_cards (org_id, user_id, order_number, reward_points)
      values (new.org_id, new.user_id, new.order_number, 5 + floor(random() * 46)::int);
    end if;
  end if;
  return new;
end $$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: run_due_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_due_subscriptions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: run_one_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_one_subscription(p_sub uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  s record; v_loc uuid; v_price numeric(12,2); v_on_hand numeric;
  v_order uuid; v_number text; v_total numeric(12,2); v_fee numeric(12,2); v_step interval;
  v_pct numeric(5,2); v_discount numeric(12,2); v_grand numeric(12,2);
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

  -- Subscribe & save: the standing subscriber discount on the subtotal.
  select coalesce(subscription_discount_percent, 0) into v_pct
    from public.organizations where id = s.org_id;
  v_discount := round(v_total * v_pct / 100, 2);
  v_grand := v_total - v_discount + v_fee;

  insert into public.orders (
    org_id, location_id, order_number, contact_name, contact_phone,
    address_line, city, pincode, landmark, delivery_slot, notes, user_id,
    subtotal, delivery_fee, discount, total
  ) values (
    s.org_id, v_loc, v_number, s.contact_name, s.contact_phone,
    s.address_line, s.city, s.pincode, s.landmark, 'tomorrow_morning',
    'Subscription order', s.user_id, v_total, v_fee, v_discount, v_grand
  ) returning id into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit, quantity, unit_price)
  select v_order, p.id, p.name, p.unit, s.quantity, v_price
  from public.products p where p.id = s.product_id;

  insert into public.stock_movements (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
  values (s.org_id, v_loc, s.product_id, -s.quantity, 'order_reserved', 'order', v_order, v_number);

  -- Fire the customer confirmation the same way a normal order does: the trigger
  -- watches for total going from 0 to a value, so nudge it.
  update public.orders set total = v_grand where id = v_order;

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (s.org_id, v_loc, 'order.placed', 'order', v_order,
          jsonb_build_object('order_number', v_number, 'total', v_grand, 'subscription', true));

  update public.subscriptions
     set next_run = (next_run + v_step)::date, last_order_at = now()
   where id = p_sub;
  return true;
end $$;


--
-- Name: run_winback(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_winback(p_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; n int := 0; v_org uuid;
begin
  select public.storefront_org_id() into v_org;
  if v_org is null then return 0; end if;

  for r in
    select o.contact_phone,
           max(o.contact_email) filter (where o.contact_email is not null) as email,
           max(o.user_id::text) as user_id,
           max(o.placed_at) as last_order
    from public.orders o
    where o.org_id = v_org and o.status <> 'cancelled'
    group by o.contact_phone
    having max(o.placed_at) < now() - make_interval(days => p_days)
  loop
    -- At most one win-back a month per number.
    if exists (
      select 1 from public.winback_log w
       where w.contact_phone = r.contact_phone
         and w.last_sent_at > now() - interval '30 days'
    ) then
      continue;
    end if;

    insert into public.notifications (org_id, channel, recipient, template, payload)
    values (v_org, 'sms', r.contact_phone, 'winback.customer', '{}'::jsonb),
           (v_org, 'whatsapp', r.contact_phone, 'winback.customer', '{}'::jsonb);
    if r.email is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (v_org, 'email', r.email, 'winback.customer', '{}'::jsonb);
    end if;
    if r.user_id is not null then
      insert into public.notifications (org_id, channel, recipient, template, payload)
      values (v_org, 'push', r.user_id, 'winback.customer', '{}'::jsonb);
    end if;

    insert into public.winback_log (contact_phone, last_sent_at)
    values (r.contact_phone, now())
    on conflict (contact_phone) do update set last_sent_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;


--
-- Name: sales_by_payment(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sales_by_payment(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: sales_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sales_summary() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org uuid; v_today date; v_week_start date; r jsonb;
begin
  perform public.require_permission('financials.read');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then
    raise exception 'Owners only.';
  end if;

  v_today := (now() at time zone 'Asia/Kolkata')::date;
  v_week_start := v_today - 6;  -- rolling 7 days incl. today

  select jsonb_build_object(
    'today_sales', coalesce((
      select sum(s.total) from public.sales s
      where s.org_id = v_org and (s.sale_date at time zone 'Asia/Kolkata')::date = v_today), 0),
    'today_count', coalesce((
      select count(*) from public.sales s
      where s.org_id = v_org and (s.sale_date at time zone 'Asia/Kolkata')::date = v_today), 0),
    'week_sales', coalesce((
      select sum(s.total) from public.sales s
      where s.org_id = v_org and (s.sale_date at time zone 'Asia/Kolkata')::date >= v_week_start), 0),
    'today_collected', coalesce((
      select sum(p.amount) from public.payments p
      where p.org_id = v_org and (p.paid_at at time zone 'Asia/Kolkata')::date = v_today), 0),
    -- Money still owed across all customers
    'outstanding', coalesce((
      select sum(cb.outstanding) from public.customer_balances cb
      where cb.org_id = v_org and cb.outstanding > 0), 0),
    -- Open online orders not yet delivered
    'open_orders', coalesce((
      select count(*) from public.orders o
      where o.org_id = v_org and o.status not in ('delivered','cancelled')), 0),
    -- Payment method split, last 7 days
    'method_split', coalesce((
      select jsonb_object_agg(method, amt) from (
        select p.method, sum(p.amount) as amt from public.payments p
        where p.org_id = v_org and (p.paid_at at time zone 'Asia/Kolkata')::date >= v_week_start
        group by p.method
      ) m), '{}'::jsonb),
    -- Top 5 products by revenue, last 7 days
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select oi_all.name, oi_all.qty, oi_all.revenue
        from (
          select p.name,
                 sum(si.quantity) as qty,
                 sum(si.line_total) as revenue
          from public.sale_items si
          join public.sales s on s.id = si.sale_id
          join public.products p on p.id = si.product_id
          where s.org_id = v_org
            and (s.sale_date at time zone 'Asia/Kolkata')::date >= v_week_start
          group by p.name
          order by revenue desc
          limit 5
        ) oi_all
      ) t), '[]'::jsonb),
    -- Low stock (under 3 units) at the storefront store
    'low_stock', coalesce((
      select jsonb_agg(l) from (
        select p.name, soh.qty
        from public.products p
        join public.organizations o on o.id = p.org_id
        join (
          select product_id, location_id, sum(delta) as qty
          from public.stock_movements group by product_id, location_id
        ) soh on soh.product_id = p.id and soh.location_id = o.storefront_location_id
        where p.org_id = v_org and p.is_published and p.is_active
          and soh.qty < 3
        order by soh.qty asc
        limit 8
      ) l), '[]'::jsonb)
  ) into r;

  return r;
end $$;


--
-- Name: save_cart(integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_cart(p_item_count integer, p_subtotal numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_org uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return; end if;
  select public.storefront_org_id() into v_org;
  if v_org is null then return; end if;

  if coalesce(p_item_count,0) <= 0 then
    delete from public.saved_carts where user_id = v_uid;
    return;
  end if;

  insert into public.saved_carts (user_id, org_id, item_count, subtotal, reminded_at, updated_at)
  values (v_uid, v_org, p_item_count, greatest(coalesce(p_subtotal,0),0), null, now())
  on conflict (user_id) do update
    set item_count = excluded.item_count, subtotal = excluded.subtotal,
        reminded_at = null, updated_at = now();
end $$;


--
-- Name: save_product(uuid, text, uuid, uuid, numeric, numeric, text, numeric, text, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_product(p_id uuid, p_name text, p_category_id uuid, p_brand_id uuid, p_sale_price numeric, p_compare_at_price numeric, p_description text, p_pack_size numeric, p_pack_unit text, p_badge text, p_image_path text, p_is_published boolean, p_sort_order integer DEFAULT 100) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid; v_slug text; v_base text; v_n int := 1; v_unit text;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then raise exception 'Only an owner can change the catalogue.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'A product needs a name.'; end if;

  if p_is_published then
    if p_sale_price is null or p_sale_price <= 0 then raise exception 'Set a price before publishing %.', p_name; end if;
    if p_category_id is null then raise exception 'Choose a category before publishing %.', p_name; end if;
  end if;

  v_unit := case when p_pack_size is null then 'kg' else 'piece' end;

  if p_id is null then
    v_base := nullif(public.slugify(p_name), '');
    if v_base is null then v_base := 'product'; end if;
    v_slug := v_base;
    while exists (select 1 from public.products where org_id = v_org and slug = v_slug) loop
      v_n := v_n + 1; v_slug := v_base || '-' || v_n;
    end loop;

    insert into public.products (
      org_id, category_id, brand_id, name, slug, unit, pack_size, pack_unit,
      sale_price, compare_at_price, description, badge, image_path,
      is_published, is_active, sort_order, min_order_qty, step_qty
    ) values (
      v_org, p_category_id, p_brand_id, trim(p_name), v_slug, v_unit,
      p_pack_size, p_pack_unit, p_sale_price, p_compare_at_price,
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_badge, '')), ''),
      nullif(trim(coalesce(p_image_path, '')), ''),
      coalesce(p_is_published, false), true, coalesce(p_sort_order, 100),
      case when p_pack_size is null then 0.5 else 1 end,
      case when p_pack_size is null then 0.5 else 1 end
    ) returning id into v_id;
  else
    update public.products p set
      category_id = p_category_id, brand_id = p_brand_id, name = trim(p_name),
      unit = v_unit, pack_size = p_pack_size, pack_unit = p_pack_unit,
      sale_price = p_sale_price, compare_at_price = p_compare_at_price,
      description = nullif(trim(coalesce(p_description, '')), ''),
      badge = nullif(trim(coalesce(p_badge, '')), ''),
      image_path = nullif(trim(coalesce(p_image_path, '')), ''),
      is_published = coalesce(p_is_published, false),
      sort_order = coalesce(p_sort_order, 100),
      min_order_qty = case when p_pack_size is null then 0.5 else 1 end,
      step_qty = case when p_pack_size is null then 0.5 else 1 end
    where p.id = p_id and p.org_id = v_org returning p.id into v_id;
    if v_id is null then raise exception 'Product not found.'; end if;
  end if;

  update public.products p set category = c.name, category_slug = c.slug
    from public.categories c where c.id = p.category_id and p.id = v_id;
  update public.products p set brand = b.name
    from public.brands b where b.id = p.brand_id and p.id = v_id;

  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(),
          case when p_id is null then 'product.created' else 'product.updated' end,
          'product', v_id,
          jsonb_build_object('name', trim(p_name), 'price', p_sale_price,
                             'published', coalesce(p_is_published, false)));
  return v_id;
end $$;


--
-- Name: save_push_subscription(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Please sign in to enable notifications.'; end if;
  if coalesce(trim(p_endpoint),'')='' or coalesce(trim(p_p256dh),'')=''
     or coalesce(trim(p_auth),'')='' then
    raise exception 'Invalid subscription.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;


--
-- Name: served_areas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.served_areas() RETURNS TABLE(pincode text, area_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select z.pincode, z.area_name
  from public.delivery_zones z
  join public.organizations o on o.id = z.org_id
  where z.is_active and o.storefront_enabled
  order by z.area_name nulls last, z.pincode;
$$;


--
-- Name: set_member_owner(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_member_owner(p_user uuid, p_is_owner boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null or not public.is_org_owner() then
    raise exception 'Only an owner can change roles.';
  end if;
  -- Can only touch members of your own org, and never yourself (no accidental
  -- self-demotion locking the org out; and no self-promotion loop).
  if p_user = auth.uid() then raise exception 'You cannot change your own owner status.'; end if;
  update public.profiles set is_owner = p_is_owner, updated_at = now()
   where id = p_user and org_id = v_org;
end $$;


--
-- Name: set_my_shift(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_my_shift(p_on boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.memberships set on_shift = p_on
   where user_id = auth.uid() and org_id = v_org;
  return p_on;
end $$;


--
-- Name: set_recipe_image(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_recipe_image(p_recipe uuid, p_path text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.recipes set image_path = nullif(trim(coalesce(p_path,'')),'')
   where id = p_recipe and org_id = v_org;
end $$;


--
-- Name: set_recipe_video(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_recipe_video(p_recipe uuid, p_url text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('catalogue.write');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.recipes set video_url = nullif(trim(coalesce(p_url,'')),'')
   where id = p_recipe and org_id = v_org;
end $$;


--
-- Name: set_supplier_active(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_supplier_active(p_id uuid, p_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.suppliers set is_active = p_active, updated_at = now()
   where id = p_id and org_id = v_org;
end $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: settle_razorpay_payment(text, text, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_razorpay_payment(p_payment_id text, p_rp_order text, p_amount integer, p_event text, p_raw jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_order record; v_mem record; v_status text; v_org uuid; v_target text; v_tid uuid;
begin
  if coalesce(p_payment_id,'') = '' then return 'no_payment_id'; end if;

  -- Idempotency gate: first writer wins; a replay finds the row and stops.
  insert into public.payment_events (razorpay_payment_id, razorpay_order_id, amount, event, raw)
  values (p_payment_id, p_rp_order, p_amount, p_event, p_raw)
  on conflict (razorpay_payment_id) do nothing;
  if not found then return 'duplicate'; end if;

  select id, total, org_id into v_order from public.orders where razorpay_order_id = p_rp_order limit 1;
  if v_order.id is not null then
    if p_amount is not null and p_amount <> round(v_order.total * 100) then
      v_status := 'amount_mismatch';                 -- never settle a mismatched amount
    else
      perform public.mark_order_paid(v_order.id, p_rp_order, p_payment_id);
      v_status := 'order_paid';
    end if;
    v_target := 'order'; v_tid := v_order.id; v_org := v_order.org_id;
  else
    select id, org_id into v_mem from public.pass_memberships where razorpay_order_id = p_rp_order limit 1;
    if v_mem.id is not null then
      perform public.activate_membership(v_mem.id, p_rp_order, p_payment_id);
      v_status := 'membership_activated';
      v_target := 'membership'; v_tid := v_mem.id; v_org := v_mem.org_id;
    else
      v_status := 'unmatched';
    end if;
  end if;

  update public.payment_events
     set status = v_status, target_type = v_target, target_id = v_tid, org_id = v_org
   where razorpay_payment_id = p_payment_id;
  return v_status;
end $$;


--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select trim(both '-' from
    regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;


--
-- Name: start_membership(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_membership(p_plan uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_plan record; v_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please sign in.'); end if;
  select * into v_plan from public.membership_plans where id = p_plan and is_active;
  if v_plan.id is null then return jsonb_build_object('ok', false, 'message', 'Plan not available.'); end if;

  insert into public.pass_memberships (org_id, user_id, plan_id, amount)
  values (v_plan.org_id, v_uid, v_plan.id, v_plan.price)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'membership_id', v_id, 'amount', v_plan.price);
end $$;


--
-- Name: stock_available(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stock_available(p_location uuid, p_product uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(delta), 0)
  from public.stock_movements
  where location_id = p_location and product_id = p_product;
$$;


--
-- Name: storefront_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.storefront_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.organizations
  where storefront_enabled
  order by created_at
  limit 1;
$$;


--
-- Name: subscription_discount_pct(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.subscription_discount_pct() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(max(subscription_discount_percent), 0)
  from public.organizations
  where storefront_location_id is not null;
$$;


--
-- Name: tip_delivery(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tip_delivery(p_number text, p_points integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid; v_o record;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Sign in to tip with points.'); end if;
  if coalesce(p_points,0) <= 0 then return jsonb_build_object('ok', false, 'message', 'Choose an amount.'); end if;
  select * into v_o from public.orders where upper(order_number) = upper(trim(coalesce(p_number,''))) and user_id = v_uid;
  if v_o.id is null then return jsonb_build_object('ok', false, 'message', 'Order not found.'); end if;
  if v_o.status <> 'delivered' then return jsonb_build_object('ok', false, 'message', 'You can tip once it''s delivered.'); end if;

  -- Serialise this user's wallet spends so two tips can't both pass the check.
  perform 1 from public.wallet_ledger where user_id = v_uid for update;
  if public.wallet_balance(v_uid) < p_points then
    return jsonb_build_object('ok', false, 'message', 'Not enough points for that tip.');
  end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_o.org_id, v_uid, -p_points, 'tip', v_o.order_number);
  update public.orders set tip_points = tip_points + p_points where id = v_o.id;
  return jsonb_build_object('ok', true, 'tip', p_points);
end $$;


--
-- Name: track_order(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_order(p_number text, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_order record; v_phone text; v_items jsonb; v_track jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');
  if coalesce(trim(p_number), '') = '' or v_phone !~ '^[6-9][0-9]{9}$' then
    return null;
  end if;

  select o.id, o.order_number, o.status, o.total, o.subtotal, o.delivery_fee,
         o.placed_at, o.confirmed_at, o.delivered_at, o.delivery_slot,
         o.contact_name, o.cancelled_reason,
         o.rider_lat, o.rider_lng, o.rider_location_at, o.eta_minutes, o.eta_set_at
    into v_order
  from public.orders o
  where upper(o.order_number) = upper(trim(p_number))
    and o.contact_phone = v_phone;

  if v_order.id is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'name', oi.product_name, 'quantity', oi.quantity,
           'unit', oi.unit, 'line_total', oi.line_total, 'slug', p.slug
         ) order by oi.product_name)
    into v_items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id;

  -- Live tracking payload only while the order is actually on the way.
  if v_order.status = 'out_for_delivery' and v_order.rider_lat is not null then
    v_track := jsonb_build_object(
      'lat', v_order.rider_lat, 'lng', v_order.rider_lng,
      'updated_at', v_order.rider_location_at,
      'eta_minutes', v_order.eta_minutes, 'eta_set_at', v_order.eta_set_at);
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number, 'status', v_order.status,
    'total', v_order.total, 'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee, 'placed_at', v_order.placed_at,
    'confirmed_at', v_order.confirmed_at, 'delivered_at', v_order.delivered_at,
    'delivery_slot', v_order.delivery_slot, 'contact_name', v_order.contact_name,
    'cancelled_reason', v_order.cancelled_reason,
    'items', coalesce(v_items, '[]'::jsonb),
    'tracking', v_track
  );
end $_$;


--
-- Name: trg_stock_batch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_stock_batch() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_need numeric; v_take numeric; b record; v_cost numeric;
begin
  if NEW.batch_id is not null then
    update public.product_batches
       set remaining_qty = remaining_qty + NEW.delta,
           status = case when remaining_qty + NEW.delta <= 0.0005 and status = 'active'
                         then 'depleted' else status end
     where id = NEW.batch_id;
    return null;
  end if;

  if NEW.delta > 0 then
    select coalesce(last_cost,0) into v_cost from public.products where id = NEW.product_id;
    insert into public.product_batches (
      org_id, location_id, product_id, batch_code, source,
      received_qty, remaining_qty, quantity, unit_cost, source_date, status
    ) values (
      NEW.org_id, NEW.location_id, NEW.product_id,
      'B-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
        lpad(nextval('public.batch_code_seq')::text, 4, '0'),
      case NEW.reason when 'production' then 'production'
                      when 'order_released' then 'return' else 'adjustment' end,
      NEW.delta, NEW.delta, NEW.delta, coalesce(v_cost,0),
      (now() at time zone 'Asia/Kolkata')::date, 'active'
    );
    return null;
  end if;

  v_need := -NEW.delta;
  for b in
    select id, remaining_qty from public.product_batches
     where product_id = NEW.product_id and location_id = NEW.location_id
       and status = 'active' and remaining_qty > 0
     order by expiry_date nulls last, created_at
  loop
    exit when v_need <= 0.0005;
    v_take := least(b.remaining_qty, v_need);
    update public.product_batches
       set remaining_qty = remaining_qty - v_take,
           status = case when remaining_qty - v_take <= 0.0005 then 'depleted' else status end
     where id = b.id;
    v_need := v_need - v_take;
  end loop;
  return null;
end $$;


--
-- Name: unit_price(numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unit_price(p_sale numeric, p_size numeric, p_unit text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case
    when p_sale is null or p_size is null or p_size <= 0 then null
    when p_unit = 'g'  then round(p_sale / (p_size / 1000.0), 2)
    when p_unit = 'kg' then round(p_sale / p_size, 2)
    when p_unit = 'ml' then round(p_sale / (p_size / 1000.0), 2)
    when p_unit = 'l'  then round(p_sale / p_size, 2)
    when p_unit = 'dozen' then round(p_sale / (p_size * 12), 2)
    when p_unit = 'piece' then round(p_sale / p_size, 2)
    else null
  end;
$$;


--
-- Name: update_rider_location(uuid, double precision, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_rider_location(p_order_id uuid, p_lat double precision, p_lng double precision, p_eta integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location.';
  end if;

  update public.orders o
     set rider_lat = p_lat, rider_lng = p_lng, rider_location_at = now(),
         eta_minutes = case when p_eta is not null then greatest(p_eta, 0) else o.eta_minutes end,
         eta_set_at  = case when p_eta is not null then now() else o.eta_set_at end
   where o.id = p_order_id and o.org_id = v_org and o.status = 'out_for_delivery';
  if not found then raise exception 'That order isn''t out for delivery.'; end if;
end $$;


--
-- Name: update_store_settings(text, text, text, text, text, numeric, numeric, text, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_settings(p_name text, p_support_email text, p_support_phone text, p_notify_email text, p_notify_phone text, p_free_delivery_threshold numeric, p_delivery_fee numeric, p_gstin text, p_business_address text, p_max_discount_percent numeric, p_subscription_discount_percent numeric DEFAULT NULL::numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid;
begin
  perform public.require_permission('settings.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  update public.organizations set
    name = coalesce(nullif(trim(p_name),''), name),
    support_email = nullif(trim(coalesce(p_support_email,'')), ''),
    support_phone = nullif(trim(coalesce(p_support_phone,'')), ''),
    notify_email = nullif(trim(coalesce(p_notify_email,'')), ''),
    notify_phone = nullif(trim(coalesce(p_notify_phone,'')), ''),
    free_delivery_threshold = greatest(coalesce(p_free_delivery_threshold, free_delivery_threshold), 0),
    delivery_fee = greatest(coalesce(p_delivery_fee, delivery_fee), 0),
    gstin = nullif(trim(coalesce(p_gstin,'')), ''),
    business_address = nullif(trim(coalesce(p_business_address,'')), ''),
    max_discount_percent = least(greatest(coalesce(p_max_discount_percent, max_discount_percent), 0), 100),
    subscription_discount_percent = least(greatest(coalesce(p_subscription_discount_percent, subscription_discount_percent), 0), 50),
    updated_at = now()
  where id = v_org;
end $$;


--
-- Name: upsert_customer(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_customer(p_location uuid, p_name text, p_phone text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_org uuid; v_id uuid; v_phone text;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then
    raise exception 'You do not have access to that location.';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number.';
  end if;

  select id into v_id from public.customers
   where org_id = v_org and phone = v_phone limit 1;

  if v_id is null then
    insert into public.customers (org_id, location_id, name, phone, type)
    values (v_org, p_location, coalesce(nullif(trim(p_name),''), 'Customer'), v_phone, 'regular')
    returning id into v_id;
  end if;

  return v_id;
end $_$;


--
-- Name: upsert_supplier(uuid, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_supplier(p_id uuid, p_name text, p_contact text, p_phone text, p_email text, p_address text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_id uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then
    raise exception 'Supplier name is required.';
  end if;
  if p_id is null then
    insert into public.suppliers (org_id, name, contact_name, phone, email, address, notes)
    values (v_org, trim(p_name), nullif(trim(coalesce(p_contact,'')),''),
            nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_email,'')),''),
            nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_id;
  else
    update public.suppliers set
      name = trim(p_name),
      contact_name = nullif(trim(coalesce(p_contact,'')),''),
      phone = nullif(trim(coalesce(p_phone,'')),''),
      email = nullif(trim(coalesce(p_email,'')),''),
      address = nullif(trim(coalesce(p_address,'')),''),
      notes = nullif(trim(coalesce(p_notes,'')),''),
      updated_at = now()
    where id = p_id and org_id = v_org
    returning id into v_id;
    if v_id is null then raise exception 'Supplier not found.'; end if;
  end if;
  return v_id;
end $$;


--
-- Name: wallet_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_balance(p_user uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount), 0)::numeric(12,2)
  from public.wallet_ledger
  where user_id = p_user and org_id = public.storefront_org_id();
$$;


--
-- Name: wastage_summary(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wastage_summary(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with w as (
    select * from public.wastage_log
    where org_id = public.current_org_id()
      and created_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
  )
  select jsonb_build_object(
    'total_value', (select coalesce(round(sum(quantity * unit_cost),2),0) from w),
    'total_events', (select count(*) from w),
    'by_reason', (select coalesce(jsonb_agg(jsonb_build_object(
        'reason', reason, 'value', value, 'events', events) order by value desc), '[]'::jsonb)
      from (select reason, round(sum(quantity*unit_cost),2) as value, count(*) as events
            from w group by reason) r),
    'by_product', (select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', product_name, 'quantity', qty, 'value', value) order by value desc), '[]'::jsonb)
      from (select product_name, sum(quantity) as qty, round(sum(quantity*unit_cost),2) as value
            from w group by product_name order by value desc limit 10) p)
  );
$$;


--
-- Name: watch_stock(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.watch_stock(p_product uuid, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_uid uuid; v_org uuid; v_email text; v_phone text;
begin
  v_uid := auth.uid();
  select org_id into v_org from public.products
   where id = p_product and is_published and is_active;
  if v_org is null then
    return jsonb_build_object('ok', false, 'message', 'That item isn''t available.');
  end if;

  v_email := lower(nullif(trim(coalesce(p_email,'')), ''));
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;

  v_phone := nullif(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), '');
  if v_phone is not null then
    v_phone := right(v_phone, 10);
    if v_phone !~ '^[6-9][0-9]{9}$' then v_phone := null; end if;
  end if;

  -- Logged-in with no explicit email: fall back to their account email.
  if v_uid is not null and v_email is null then
    select lower(nullif(trim(email), '')) into v_email from auth.users where id = v_uid;
  end if;

  if v_uid is null and v_email is null and v_phone is null then
    return jsonb_build_object('ok', false,
      'message', 'Add an email or mobile number so we can reach you.');
  end if;

  if exists (
    select 1 from public.stock_alerts a
     where a.product_id = p_product and a.notified_at is null
       and ((v_uid is not null and a.user_id = v_uid)
         or (v_email is not null and a.email = v_email)
         or (v_phone is not null and a.phone = v_phone))
  ) then
    return jsonb_build_object('ok', true, 'message', 'You''re already on the list.');
  end if;

  insert into public.stock_alerts (org_id, product_id, user_id, email, phone)
  values (v_org, p_product, v_uid, v_email, v_phone);
  return jsonb_build_object('ok', true, 'message', 'Done — we''ll let you know when it''s back.');
end $_$;


--
-- Name: write_off_batch(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_off_batch(p_batch uuid, p_reason text DEFAULT 'expiry'::text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; b record;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if p_reason not in ('spoilage','expiry','damage','theft','count_adjustment','other') then
    raise exception 'Pick a valid reason.';
  end if;
  select * into b from public.product_batches where id = p_batch and org_id = v_org;
  if b.id is null then raise exception 'Batch not found.'; end if;
  if b.remaining_qty <= 0 then raise exception 'This batch has no stock left.'; end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note, batch_id)
  values (v_org, b.location_id, b.product_id, -b.remaining_qty, 'waste', 'wastage', p_batch, auth.uid(),
          p_reason || ' — batch ' || b.batch_code || coalesce(' — ' || nullif(trim(coalesce(p_note,'')),''), ''),
          p_batch);

  insert into public.wastage_log
    (org_id, location_id, product_id, product_name, quantity, reason, unit_cost, note, actor_id)
  select v_org, b.location_id, b.product_id, p.name, b.remaining_qty, p_reason, b.unit_cost,
         'Batch ' || b.batch_code || coalesce(' — ' || nullif(trim(coalesce(p_note,'')),''), ''), auth.uid()
  from public.products p where p.id = b.product_id;
end $$;


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    subtitle text,
    cta_label text,
    href text,
    bg_from text DEFAULT '#16a34a'::text NOT NULL,
    bg_to text DEFAULT '#14532d'::text NOT NULL,
    image_path text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    description text,
    is_house_brand boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    parent_id uuid,
    slug text NOT NULL,
    name text NOT NULL,
    icon text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: category_affinity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_affinity (
    org_id uuid NOT NULL,
    from_slug text NOT NULL,
    to_slug text NOT NULL,
    weight numeric DEFAULT 1 NOT NULL
);


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: cold_chain_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cold_chain_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    area text NOT NULL,
    temp_c numeric(5,2) NOT NULL,
    target_min numeric(5,2),
    target_max numeric(5,2),
    breach boolean DEFAULT false NOT NULL,
    note text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    code text NOT NULL,
    kind text NOT NULL,
    value numeric(12,2) NOT NULL,
    max_discount numeric(12,2),
    min_subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    per_phone_limit integer DEFAULT 1 NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT coupons_kind_check CHECK ((kind = ANY (ARRAY['percent'::text, 'flat'::text]))),
    CONSTRAINT coupons_value_check CHECK ((value > (0)::numeric))
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text,
    contact_name text,
    contact_phone text,
    address_line text NOT NULL,
    city text,
    pincode text,
    landmark text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lat double precision,
    lng double precision
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    type text DEFAULT 'regular'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_type_check CHECK ((type = ANY (ARRAY['walk_in'::text, 'regular'::text, 'restaurant'::text, 'bulk'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    sale_id uuid,
    customer_id uuid,
    amount numeric(12,2) NOT NULL,
    method text DEFAULT 'cash'::text NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'upi'::text, 'card'::text, 'bank_transfer'::text, 'other'::text])))
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    customer_id uuid,
    sale_date timestamp with time zone DEFAULT now() NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'credit'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'partial'::text, 'credit'::text]))),
    CONSTRAINT sales_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: customer_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_balances WITH (security_invoker='true') AS
 SELECT c.id AS customer_id,
    c.org_id,
    c.location_id,
    c.name,
    c.phone,
    COALESCE(s.total_billed, (0)::numeric) AS total_billed,
    COALESCE(p.total_paid, (0)::numeric) AS total_paid,
    (COALESCE(s.total_billed, (0)::numeric) - COALESCE(p.total_paid, (0)::numeric)) AS outstanding
   FROM ((public.customers c
     LEFT JOIN ( SELECT sales.customer_id,
            sum(sales.total) AS total_billed
           FROM public.sales
          WHERE (sales.customer_id IS NOT NULL)
          GROUP BY sales.customer_id) s ON ((s.customer_id = c.id)))
     LEFT JOIN ( SELECT payments.customer_id,
            sum(payments.amount) AS total_paid
           FROM public.payments
          WHERE (payments.customer_id IS NOT NULL)
          GROUP BY payments.customer_id) p ON ((p.customer_id = c.id)));


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    pincode text NOT NULL,
    area_name text,
    delivery_fee numeric(12,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid,
    actor_id uuid,
    event_type text NOT NULL,
    entity_type text,
    entity_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    code text NOT NULL,
    value numeric(12,2) NOT NULL,
    redeemed_by uuid,
    redeemed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gift_cards_value_check CHECK ((value > (0)::numeric))
);


--
-- Name: hamper_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hamper_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hamper_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(12,3) NOT NULL,
    CONSTRAINT hamper_items_qty_check CHECK ((qty > (0)::numeric))
);


--
-- Name: hampers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hampers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    image_path text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: location_daily_sales; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.location_daily_sales WITH (security_invoker='true') AS
 SELECT org_id,
    location_id,
    (date_trunc('day'::text, sale_date))::date AS day,
    count(*) AS sale_count,
    sum(total) AS total_billed,
    sum(amount_paid) AS total_collected,
    sum((total - amount_paid)) AS outstanding
   FROM public.sales s
  GROUP BY org_id, location_id, ((date_trunc('day'::text, sale_date))::date);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    city_id uuid,
    type text NOT NULL,
    name text NOT NULL,
    code text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT locations_type_check CHECK ((type = ANY (ARRAY['farm'::text, 'store'::text])))
);


--
-- Name: markdowns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.markdowns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    clearance_price numeric(12,2) NOT NULL,
    orig_sale_price numeric(12,2) NOT NULL,
    orig_compare_at numeric(12,2),
    orig_badge text,
    reason text,
    ends_on date NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    on_shift boolean DEFAULT false NOT NULL,
    CONSTRAINT memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text, 'accountant'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    channel text NOT NULL,
    recipient text NOT NULL,
    template text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    claimed_at timestamp with time zone,
    CONSTRAINT notifications_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'push'::text]))),
    CONSTRAINT notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    staff_member_id uuid NOT NULL,
    station_id uuid,
    clock_in_at timestamp with time zone DEFAULT now() NOT NULL,
    clock_out_at timestamp with time zone,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_check CHECK (((clock_out_at IS NULL) OR (clock_out_at >= clock_in_at)))
);


--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    profile_id uuid,
    full_name text NOT NULL,
    phone text,
    job_title text,
    employment text DEFAULT 'production'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_members_employment_check CHECK ((employment = ANY (ARRAY['production'::text, 'office'::text, 'contract'::text])))
);


--
-- Name: open_shifts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.open_shifts WITH (security_invoker='true') AS
 SELECT sh.id AS shift_id,
    sh.org_id,
    sh.location_id,
    sh.staff_member_id,
    s.full_name,
    s.job_title,
    sh.station_id,
    sh.clock_in_at,
    (now() - sh.clock_in_at) AS elapsed
   FROM (public.shifts sh
     JOIN public.staff_members s ON ((s.id = sh.staff_member_id)))
  WHERE (sh.clock_out_at IS NULL);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(14,2) GENERATED ALWAYS AS (round((quantity * unit_price), 2)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_queue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.order_queue AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS org_id,
    NULL::text AS order_number,
    NULL::text AS contact_name,
    NULL::text AS contact_phone,
    NULL::text AS address_line,
    NULL::text AS city,
    NULL::text AS pincode,
    NULL::text AS delivery_slot,
    NULL::text AS status,
    NULL::numeric(12,2) AS total,
    NULL::timestamp with time zone AS placed_at,
    NULL::bigint AS item_count,
    NULL::numeric AS total_quantity;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid,
    order_number text NOT NULL,
    customer_id uuid,
    contact_name text NOT NULL,
    contact_phone text NOT NULL,
    address_line text NOT NULL,
    city text,
    pincode text,
    landmark text,
    delivery_slot text,
    notes text,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    delivery_fee numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method text DEFAULT 'cod'::text NOT NULL,
    status text DEFAULT 'placed'::text NOT NULL,
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cancelled_reason text,
    sale_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_email text,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    coupon_code text,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    user_id uuid,
    credit_used numeric(12,2) DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    razorpay_order_id text,
    razorpay_payment_id text,
    paid_at timestamp with time zone,
    rider_lat double precision,
    rider_lng double precision,
    rider_location_at timestamp with time zone,
    eta_minutes integer,
    eta_set_at timestamp with time zone,
    delivery_rating integer,
    delivery_comment text,
    rated_at timestamp with time zone,
    address_lat double precision,
    address_lng double precision,
    tip_points integer DEFAULT 0 NOT NULL,
    CONSTRAINT orders_delivery_fee_check CHECK ((delivery_fee >= (0)::numeric)),
    CONSTRAINT orders_delivery_rating_check CHECK (((delivery_rating >= 1) AND (delivery_rating <= 5))),
    CONSTRAINT orders_discount_check CHECK ((discount >= (0)::numeric)),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cod'::text, 'upi_on_delivery'::text, 'upi'::text, 'card'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'placed'::text, 'confirmed'::text, 'packed'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text]))),
    CONSTRAINT orders_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT orders_total_check CHECK ((total >= (0)::numeric))
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storefront_enabled boolean DEFAULT false NOT NULL,
    slug text,
    storefront_location_id uuid,
    notify_email text,
    notify_phone text,
    support_email text,
    support_phone text,
    free_delivery_threshold numeric(12,2) DEFAULT 500 NOT NULL,
    delivery_fee numeric(12,2) DEFAULT 40 NOT NULL,
    gstin text,
    business_address text,
    max_discount_percent numeric(5,2) DEFAULT 50 NOT NULL,
    subscription_discount_percent numeric(5,2) DEFAULT 5 NOT NULL,
    CONSTRAINT organizations_subscription_discount_percent_check CHECK (((subscription_discount_percent >= (0)::numeric) AND (subscription_discount_percent <= (50)::numeric)))
);


--
-- Name: pass_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pass_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    razorpay_order_id text,
    razorpay_payment_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pass_memberships_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'active'::text, 'expired'::text])))
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    razorpay_payment_id text NOT NULL,
    razorpay_order_id text,
    amount integer,
    event text,
    target_type text,
    target_id uuid,
    org_id uuid,
    status text,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: po_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.po_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    farm_id uuid,
    batch_code text NOT NULL,
    source_date date,
    quantity numeric(12,3),
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    source text DEFAULT 'purchase'::text NOT NULL,
    po_id uuid,
    supplier_id uuid,
    received_qty numeric(12,3) DEFAULT 0 NOT NULL,
    remaining_qty numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    expiry_date date,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT product_batches_source_check CHECK ((source = ANY (ARRAY['purchase'::text, 'production'::text, 'opening'::text, 'adjustment'::text, 'return'::text, 'traceability'::text]))),
    CONSTRAINT product_batches_status_check CHECK ((status = ANY (ARRAY['active'::text, 'depleted'::text, 'expired'::text, 'recalled'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    description text,
    sale_price numeric(12,2),
    image_path text,
    category text,
    is_published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    min_order_qty numeric(12,3) DEFAULT 0.5 NOT NULL,
    step_qty numeric(12,3) DEFAULT 0.5 NOT NULL,
    compare_at_price numeric(12,2),
    badge text,
    category_slug text,
    category_sort integer DEFAULT 100 NOT NULL,
    category_id uuid,
    pack_size numeric(12,3),
    pack_unit text,
    brand text,
    brand_id uuid,
    diet_tags text[] DEFAULT '{}'::text[] NOT NULL,
    last_cost numeric(12,2),
    CONSTRAINT products_compare_at_price_check CHECK ((compare_at_price >= (0)::numeric)),
    CONSTRAINT products_compare_price_sane CHECK (((compare_at_price IS NULL) OR (sale_price IS NULL) OR (compare_at_price > sale_price))),
    CONSTRAINT products_last_cost_check CHECK ((last_cost >= (0)::numeric)),
    CONSTRAINT products_pack_consistent CHECK ((((pack_size IS NULL) AND (pack_unit IS NULL)) OR ((pack_size IS NOT NULL) AND (pack_unit IS NOT NULL)))),
    CONSTRAINT products_pack_size_check CHECK (((pack_size IS NULL) OR (pack_size > (0)::numeric))),
    CONSTRAINT products_pack_unit_check CHECK ((pack_unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'dozen'::text]))),
    CONSTRAINT products_publishable CHECK (((NOT is_published) OR ((slug IS NOT NULL) AND (sale_price IS NOT NULL) AND (sale_price > (0)::numeric)))),
    CONSTRAINT products_sale_price_check CHECK ((sale_price >= (0)::numeric)),
    CONSTRAINT products_unit_check CHECK ((unit = ANY (ARRAY['kg'::text, 'piece'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    full_name text,
    is_owner boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    qty_ordered numeric(12,3) NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    qty_received numeric(12,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_order_items_qty_ordered_check CHECK ((qty_ordered > (0)::numeric)),
    CONSTRAINT purchase_order_items_qty_received_check CHECK ((qty_received >= (0)::numeric)),
    CONSTRAINT purchase_order_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    supplier_id uuid,
    po_number text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    ordered_at timestamp with time zone,
    received_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recipe_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(12,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_items_qty_check CHECK ((qty > (0)::numeric))
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    cuisine text NOT NULL,
    is_diet boolean DEFAULT false NOT NULL,
    servings integer DEFAULT 4 NOT NULL,
    description text,
    image_path text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    video_url text,
    CONSTRAINT recipes_servings_check CHECK ((servings > 0))
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    user_id uuid NOT NULL,
    code text NOT NULL,
    referred_by uuid,
    reward_paid boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    author_name text NOT NULL,
    rating integer NOT NULL,
    body text,
    contact_hash text,
    verified boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: role_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_capabilities (
    role text NOT NULL,
    capability text NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(14,2) GENERATED ALWAYS AS (round((quantity * unit_price), 2)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT sale_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: saved_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_carts (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    reminded_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scratch_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scratch_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_number text NOT NULL,
    reward_points integer NOT NULL,
    revealed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    staff_member_id uuid NOT NULL,
    card_uid_hash bytea NOT NULL,
    label text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text
);


--
-- Name: stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    profile_id uuid,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid,
    email text,
    phone text,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    lot_code text,
    expiry_date date,
    status text DEFAULT 'in_stock'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_items_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT stock_items_status_check CHECK ((status = ANY (ARRAY['in_stock'::text, 'sold_out'::text, 'wasted'::text])))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    delta numeric(12,3) NOT NULL,
    reason text NOT NULL,
    ref_type text,
    ref_id uuid,
    actor_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_id uuid,
    CONSTRAINT stock_movements_delta_check CHECK ((delta <> (0)::numeric)),
    CONSTRAINT stock_movements_reason_check CHECK ((reason = ANY (ARRAY['production'::text, 'purchase'::text, 'sale'::text, 'order_reserved'::text, 'order_released'::text, 'waste'::text, 'adjustment'::text, 'stock_count'::text, 'transfer_in'::text, 'transfer_out'::text])))
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_on_hand; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.stock_on_hand WITH (security_invoker='true') AS
 SELECT m.org_id,
    m.location_id,
    m.product_id,
    p.name AS product_name,
    sum(m.delta) AS quantity
   FROM (public.stock_movements m
     JOIN public.products p ON ((p.id = m.product_id)))
  GROUP BY m.org_id, m.location_id, m.product_id, p.name;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    frequency text NOT NULL,
    next_run date NOT NULL,
    contact_name text NOT NULL,
    contact_phone text NOT NULL,
    address_line text NOT NULL,
    city text,
    pincode text,
    landmark text,
    is_active boolean DEFAULT true NOT NULL,
    last_order_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT subscriptions_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_ledger (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.wallet_ledger ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wastage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wastage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    reason text NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    note text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wastage_log_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT wastage_log_reason_check CHECK ((reason = ANY (ARRAY['spoilage'::text, 'expiry'::text, 'damage'::text, 'theft'::text, 'count_adjustment'::text, 'other'::text]))),
    CONSTRAINT wastage_log_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: winback_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.winback_log (
    contact_phone text NOT NULL,
    last_sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: brands brands_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: categories categories_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_affinity category_affinity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_affinity
    ADD CONSTRAINT category_affinity_pkey PRIMARY KEY (org_id, from_slug, to_slug);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cities cities_state_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_name_key UNIQUE (state_id, name);


--
-- Name: cold_chain_logs cold_chain_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cold_chain_logs
    ADD CONSTRAINT cold_chain_logs_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_org_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_org_id_code_key UNIQUE (org_id, code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_org_id_pincode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_org_id_pincode_key UNIQUE (org_id, pincode);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: farms farms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_code_key UNIQUE (code);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: hamper_items hamper_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hamper_items
    ADD CONSTRAINT hamper_items_pkey PRIMARY KEY (id);


--
-- Name: hampers hampers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hampers
    ADD CONSTRAINT hampers_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: markdowns markdowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdowns
    ADD CONSTRAINT markdowns_pkey PRIMARY KEY (id);


--
-- Name: membership_plans membership_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_user_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_location_id_key UNIQUE (user_id, location_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_org_id_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_org_id_order_number_key UNIQUE (org_id, order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: pass_memberships pass_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pass_memberships
    ADD CONSTRAINT pass_memberships_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_razorpay_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_razorpay_payment_id_key UNIQUE (razorpay_payment_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


--
-- Name: products products_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_org_id_name_key UNIQUE (org_id, name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_code_key UNIQUE (code);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (user_id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_product_id_contact_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_contact_hash_key UNIQUE (product_id, contact_hash);


--
-- Name: role_capabilities role_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_capabilities
    ADD CONSTRAINT role_capabilities_pkey PRIMARY KEY (role, capability);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: saved_carts saved_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_carts
    ADD CONSTRAINT saved_carts_pkey PRIMARY KEY (user_id);


--
-- Name: scratch_cards scratch_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scratch_cards
    ADD CONSTRAINT scratch_cards_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: staff_cards staff_cards_org_id_card_uid_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_org_id_card_uid_hash_key UNIQUE (org_id, card_uid_hash);


--
-- Name: staff_cards staff_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_pkey PRIMARY KEY (id);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: states states_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_key UNIQUE (name);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: stations stations_org_id_location_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_org_id_location_id_name_key UNIQUE (org_id, location_id, name);


--
-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (id);


--
-- Name: stock_alerts stock_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_alerts
    ADD CONSTRAINT stock_alerts_pkey PRIMARY KEY (id);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: wallet_ledger wallet_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: wastage_log wastage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_pkey PRIMARY KEY (id);


--
-- Name: winback_log winback_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.winback_log
    ADD CONSTRAINT winback_log_pkey PRIMARY KEY (contact_phone);


--
-- Name: idx_addr_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_addr_user ON public.customer_addresses USING btree (user_id);


--
-- Name: idx_banners_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banners_active ON public.banners USING btree (org_id, sort_order) WHERE is_active;


--
-- Name: idx_batch_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_expiry ON public.product_batches USING btree (expiry_date) WHERE (status = 'active'::text);


--
-- Name: idx_batch_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_lookup ON public.product_batches USING btree (org_id, location_id, product_id, status);


--
-- Name: idx_batches_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_product ON public.product_batches USING btree (product_id, created_at DESC);


--
-- Name: idx_brands_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_org ON public.brands USING btree (org_id, sort_order);


--
-- Name: idx_cards_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_active ON public.staff_cards USING btree (org_id, card_uid_hash) WHERE (revoked_at IS NULL);


--
-- Name: idx_cards_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_staff ON public.staff_cards USING btree (staff_member_id);


--
-- Name: idx_categories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_org ON public.categories USING btree (org_id, sort_order);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id, sort_order);


--
-- Name: idx_cities_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cities_state ON public.cities USING btree (state_id);


--
-- Name: idx_coldchain_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coldchain_org ON public.cold_chain_logs USING btree (org_id, created_at);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (org_id, upper(code)) WHERE is_active;


--
-- Name: idx_customers_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_loc ON public.customers USING btree (org_id, location_id);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created ON public.events USING btree (created_at);


--
-- Name: idx_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_entity ON public.events USING btree (entity_type, entity_id);


--
-- Name: idx_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_org ON public.events USING btree (org_id);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_type ON public.events USING btree (event_type);


--
-- Name: idx_locations_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_city ON public.locations USING btree (city_id);


--
-- Name: idx_locations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_org ON public.locations USING btree (org_id);


--
-- Name: idx_locations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_type ON public.locations USING btree (org_id, type);


--
-- Name: idx_memberships_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_loc ON public.memberships USING btree (location_id);


--
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user ON public.memberships USING btree (user_id);


--
-- Name: idx_notifications_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_pending ON public.notifications USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_assigned ON public.orders USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);


--
-- Name: idx_orders_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_org_status ON public.orders USING btree (org_id, status, placed_at DESC);


--
-- Name: idx_orders_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_phone ON public.orders USING btree (contact_phone);


--
-- Name: idx_orders_phone_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_phone_recent ON public.orders USING btree (contact_phone, placed_at DESC);


--
-- Name: idx_pass_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pass_user ON public.pass_memberships USING btree (user_id);


--
-- Name: idx_payments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer ON public.payments USING btree (customer_id);


--
-- Name: idx_payments_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_org_loc ON public.payments USING btree (org_id, location_id);


--
-- Name: idx_payments_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_sale ON public.payments USING btree (sale_id);


--
-- Name: idx_po_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_org ON public.purchase_orders USING btree (org_id, status);


--
-- Name: idx_poi_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poi_po ON public.purchase_order_items USING btree (po_id);


--
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand ON public.products USING btree (org_id, brand_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (org_id, category_slug, category_sort);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (org_id, category_id, sort_order);


--
-- Name: idx_products_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_org ON public.products USING btree (org_id);


--
-- Name: idx_products_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_published ON public.products USING btree (org_id, is_published, sort_order);


--
-- Name: idx_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_org ON public.profiles USING btree (org_id);


--
-- Name: idx_push_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_returns_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_org_status ON public.returns USING btree (org_id, status);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id) WHERE is_published;


--
-- Name: idx_sale_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_product ON public.sale_items USING btree (product_id);


--
-- Name: idx_sale_items_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sales_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_customer ON public.sales USING btree (customer_id);


--
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- Name: idx_sales_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_org_loc ON public.sales USING btree (org_id, location_id);


--
-- Name: idx_sales_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_status ON public.sales USING btree (payment_status);


--
-- Name: idx_scratch_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scratch_pending ON public.scratch_cards USING btree (user_id) WHERE (revealed_at IS NULL);


--
-- Name: idx_shifts_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_org_loc ON public.shifts USING btree (org_id, location_id);


--
-- Name: idx_shifts_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_staff ON public.shifts USING btree (staff_member_id, clock_in_at);


--
-- Name: idx_staff_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_active ON public.staff_members USING btree (org_id, is_active);


--
-- Name: idx_staff_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_org_loc ON public.staff_members USING btree (org_id, location_id);


--
-- Name: idx_stations_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stations_org_loc ON public.stations USING btree (org_id, location_id);


--
-- Name: idx_stock_alert_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_alert_pending ON public.stock_alerts USING btree (product_id) WHERE (notified_at IS NULL);


--
-- Name: idx_stock_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_expiry ON public.stock_items USING btree (expiry_date);


--
-- Name: idx_stock_org_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_org_loc ON public.stock_items USING btree (org_id, location_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_product ON public.stock_items USING btree (product_id);


--
-- Name: idx_stockmov_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stockmov_batch ON public.stock_movements USING btree (batch_id);


--
-- Name: idx_stockmov_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stockmov_created ON public.stock_movements USING btree (created_at);


--
-- Name: idx_stockmov_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stockmov_lookup ON public.stock_movements USING btree (org_id, location_id, product_id);


--
-- Name: idx_stockmov_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stockmov_ref ON public.stock_movements USING btree (ref_type, ref_id);


--
-- Name: idx_subs_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subs_due ON public.subscriptions USING btree (next_run) WHERE is_active;


--
-- Name: idx_subs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subs_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_suppliers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_org ON public.suppliers USING btree (org_id) WHERE is_active;


--
-- Name: idx_support_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_org_status ON public.support_tickets USING btree (org_id, status);


--
-- Name: idx_wallet_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_user ON public.wallet_ledger USING btree (user_id);


--
-- Name: idx_wastage_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wastage_org ON public.wastage_log USING btree (org_id, created_at);


--
-- Name: idx_zones_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zones_org ON public.delivery_zones USING btree (org_id, pincode) WHERE is_active;


--
-- Name: uq_markdown_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_markdown_active ON public.markdowns USING btree (product_id) WHERE active;


--
-- Name: uq_one_primary_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_one_primary_brand ON public.brands USING btree (org_id) WHERE is_primary;


--
-- Name: uq_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_org_slug ON public.organizations USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: uq_products_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_products_slug ON public.products USING btree (org_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: uq_shift_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_shift_one_open ON public.shifts USING btree (staff_member_id) WHERE (clock_out_at IS NULL);


--
-- Name: order_queue _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.order_queue WITH (security_invoker='true') AS
 SELECT o.id,
    o.org_id,
    o.order_number,
    o.contact_name,
    o.contact_phone,
    o.address_line,
    o.city,
    o.pincode,
    o.delivery_slot,
    o.status,
    o.total,
    o.placed_at,
    count(oi.id) AS item_count,
    sum(oi.quantity) AS total_quantity
   FROM (public.orders o
     LEFT JOIN public.order_items oi ON ((oi.order_id = o.id)))
  WHERE (o.status <> ALL (ARRAY['delivered'::text, 'cancelled'::text]))
  GROUP BY o.id;


--
-- Name: brands trg_brands_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_category_depth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_category_depth BEFORE INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.check_category_depth();


--
-- Name: customers trg_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: events trg_events_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_no_update BEFORE DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.block_mutation();


--
-- Name: locations trg_locations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_movements trg_notify_on_restock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_on_restock AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.notify_on_restock();


--
-- Name: customer_addresses trg_one_default_address; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_one_default_address AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses FOR EACH ROW WHEN (new.is_default) EXECUTE FUNCTION public.one_default_address();


--
-- Name: orders trg_order_customer_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_customer_notify AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_notification();


--
-- Name: orders trg_order_rewards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_rewards AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.reward_on_delivery();


--
-- Name: orders trg_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments trg_payment_recalc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_recalc AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.recalc_sale_payment();


--
-- Name: products trg_products_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales trg_sales_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shifts trg_shifts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff_members trg_staff_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stations trg_stations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stations_updated BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_movements trg_stock_batch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_batch AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.trg_stock_batch();


--
-- Name: stock_items trg_stock_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_updated BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_movements trg_stockmov_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stockmov_no_update BEFORE DELETE OR UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.block_mutation();


--
-- Name: banners banners_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: brands brands_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: categories categories_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_affinity category_affinity_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_affinity
    ADD CONSTRAINT category_affinity_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE RESTRICT;


--
-- Name: cold_chain_logs cold_chain_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cold_chain_logs
    ADD CONSTRAINT cold_chain_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: cold_chain_logs cold_chain_logs_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cold_chain_logs
    ADD CONSTRAINT cold_chain_logs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: cold_chain_logs cold_chain_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cold_chain_logs
    ADD CONSTRAINT cold_chain_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delivery_zones delivery_zones_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: events events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: events events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: events events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: farms farms_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: gift_cards gift_cards_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: gift_cards gift_cards_redeemed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: hamper_items hamper_items_hamper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hamper_items
    ADD CONSTRAINT hamper_items_hamper_id_fkey FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE;


--
-- Name: hamper_items hamper_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hamper_items
    ADD CONSTRAINT hamper_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: hampers hampers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hampers
    ADD CONSTRAINT hampers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: locations locations_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: locations locations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: markdowns markdowns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdowns
    ADD CONSTRAINT markdowns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: markdowns markdowns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdowns
    ADD CONSTRAINT markdowns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: markdowns markdowns_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdowns
    ADD CONSTRAINT markdowns_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: membership_plans membership_plans_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: orders orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: orders orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: orders orders_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizations organizations_storefront_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_storefront_location_id_fkey FOREIGN KEY (storefront_location_id) REFERENCES public.locations(id);


--
-- Name: pass_memberships pass_memberships_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pass_memberships
    ADD CONSTRAINT pass_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pass_memberships pass_memberships_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pass_memberships
    ADD CONSTRAINT pass_memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id);


--
-- Name: pass_memberships pass_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pass_memberships
    ADD CONSTRAINT pass_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: payments payments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: payments payments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payments payments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: product_batches product_batches_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE SET NULL;


--
-- Name: product_batches product_batches_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: product_batches product_batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: product_batches product_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipe_items recipe_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: recipe_items recipe_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES auth.users(id);


--
-- Name: referrals referrals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: returns returns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: returns returns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: sales sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: sales sales_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: sales sales_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: saved_carts saved_carts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_carts
    ADD CONSTRAINT saved_carts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: saved_carts saved_carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_carts
    ADD CONSTRAINT saved_carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scratch_cards scratch_cards_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scratch_cards
    ADD CONSTRAINT scratch_cards_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scratch_cards scratch_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scratch_cards
    ADD CONSTRAINT scratch_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: shifts shifts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_staff_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_staff_member_id_fkey FOREIGN KEY (staff_member_id) REFERENCES public.staff_members(id) ON DELETE RESTRICT;


--
-- Name: shifts shifts_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE SET NULL;


--
-- Name: staff_cards staff_cards_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: staff_cards staff_cards_staff_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_staff_member_id_fkey FOREIGN KEY (staff_member_id) REFERENCES public.staff_members(id) ON DELETE CASCADE;


--
-- Name: staff_members staff_members_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: staff_members staff_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: staff_members staff_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: stations stations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: stations stations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stations stations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: stock_alerts stock_alerts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_alerts
    ADD CONSTRAINT stock_alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_alerts stock_alerts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_alerts
    ADD CONSTRAINT stock_alerts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_alerts stock_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_alerts
    ADD CONSTRAINT stock_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stock_items stock_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: stock_items stock_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_items stock_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: wallet_ledger wallet_ledger_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: wallet_ledger wallet_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wastage_log wastage_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: wastage_log wastage_log_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: wastage_log wastage_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: wastage_log wastage_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: customer_addresses addr_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY addr_read ON public.customer_addresses FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: customer_addresses addr_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY addr_write ON public.customer_addresses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: category_affinity affinity_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affinity_owner ON public.category_affinity TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: category_affinity affinity_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affinity_read ON public.category_affinity FOR SELECT TO authenticated, anon USING (true);


--
-- Name: banners banner_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY banner_owner ON public.banners TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: banners banner_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY banner_public_read ON public.banners FOR SELECT TO authenticated, anon USING ((is_active AND public.is_storefront_org(org_id)));


--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: product_batches batches_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batches_staff ON public.product_batches FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: brands brand_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_owner_write ON public.brands TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: brands brand_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_public_read ON public.brands FOR SELECT TO anon USING ((is_active AND public.is_storefront_org(org_id)));


--
-- Name: brands brand_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_staff_read ON public.brands FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_cards cards_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cards_all ON public.staff_cards TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: saved_carts cart_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cart_own ON public.saved_carts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: categories cat_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cat_owner_write ON public.categories TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: categories cat_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cat_public_read ON public.categories FOR SELECT TO anon USING ((is_active AND public.is_storefront_org(org_id)));


--
-- Name: categories cat_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cat_staff_read ON public.categories FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: category_affinity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_affinity ENABLE ROW LEVEL SECURITY;

--
-- Name: cities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

--
-- Name: cities cities_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cities_read ON public.cities FOR SELECT TO authenticated USING (true);


--
-- Name: cold_chain_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cold_chain_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: cold_chain_logs coldchain_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coldchain_read ON public.cold_chain_logs FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: coupons coupon_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupon_owner_all ON public.coupons TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: customers cust_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cust_delete ON public.customers FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: customers cust_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cust_read ON public.customers FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: customers cust_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cust_update ON public.customers FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id))) WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: customers cust_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cust_write ON public.customers FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events evt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_insert ON public.events FOR INSERT TO authenticated WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: events evt_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_read ON public.events FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: farms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

--
-- Name: farms farms_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY farms_staff ON public.farms FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: gift_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: hamper_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hamper_items ENABLE ROW LEVEL SECURITY;

--
-- Name: hampers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hampers ENABLE ROW LEVEL SECURITY;

--
-- Name: hampers hampers_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hampers_staff ON public.hampers FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: locations loc_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loc_read ON public.locations FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: locations loc_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loc_write ON public.locations TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: markdowns markdown_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY markdown_read ON public.markdowns FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: markdowns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.markdowns ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships mem_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mem_read ON public.memberships FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: memberships mem_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mem_write ON public.memberships TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: memberships membership_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membership_own ON public.memberships FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: membership_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notif_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_staff_read ON public.notifications FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_read ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.org_id = public.current_org_id())))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: orders orders_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND (public.is_org_owner() OR (location_id IS NULL) OR public.has_location(location_id))));


--
-- Name: orders orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND (public.is_org_owner() OR public.has_location(location_id)))) WITH CHECK (((org_id = public.current_org_id()) AND (public.is_org_owner() OR public.has_location(location_id))));


--
-- Name: organizations org_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_read ON public.organizations FOR SELECT TO authenticated USING ((id = public.current_org_id()));


--
-- Name: organizations org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_update ON public.organizations FOR UPDATE TO authenticated USING (((id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: pass_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pass_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: pass_memberships pass_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pass_own ON public.pass_memberships FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: payments pay_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_delete ON public.payments FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: payments pay_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_read ON public.payments FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: payments pay_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_write ON public.payments FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_plans plans_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_public_read ON public.membership_plans FOR SELECT USING ((is_active = true));


--
-- Name: purchase_orders po_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY po_read ON public.purchase_orders FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: purchase_order_items poi_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY poi_read ON public.purchase_order_items FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: products prod_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prod_delete ON public.products FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: products prod_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prod_public_read ON public.products FOR SELECT TO anon USING ((is_published AND is_active AND public.is_storefront_org(org_id)));


--
-- Name: products prod_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prod_read ON public.products FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: products prod_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prod_update ON public.products FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: products prod_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prod_write ON public.products FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: product_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles prof_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_read ON public.profiles FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: profiles prof_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_own ON public.push_subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes recipes_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_staff ON public.recipes FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: referrals referral_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referral_read_own ON public.referrals FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

--
-- Name: returns returns_customer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY returns_customer_read ON public.returns FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: returns returns_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY returns_staff_read ON public.returns FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: reviews review_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY review_owner ON public.reviews TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: reviews review_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY review_public_read ON public.reviews FOR SELECT TO authenticated, anon USING ((is_published AND public.is_storefront_org(org_id)));


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: role_capabilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;

--
-- Name: role_capabilities role_capabilities_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_capabilities_read ON public.role_capabilities FOR SELECT TO authenticated USING (true);


--
-- Name: sales sale_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sale_delete ON public.sales FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales sale_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sale_read ON public.sales FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: sales sale_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sale_update ON public.sales FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id))) WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: sales sale_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sale_write ON public.sales FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: scratch_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scratch_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: scratch_cards scratch_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scratch_own ON public.scratch_cards FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts shifts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_delete ON public.shifts FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: shifts shifts_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_read ON public.shifts FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: shifts shifts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_update ON public.shifts FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id))) WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: shifts shifts_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_write ON public.shifts FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: sale_items si_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY si_read ON public.sale_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.org_id = public.current_org_id()) AND public.has_location(s.location_id)))));


--
-- Name: sale_items si_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY si_write ON public.sale_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.org_id = public.current_org_id()) AND public.has_location(s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.org_id = public.current_org_id()) AND public.has_location(s.location_id)))));


--
-- Name: staff_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_read ON public.staff_members FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: staff_members staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write ON public.staff_members TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

--
-- Name: states states_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY states_read ON public.states FOR SELECT TO authenticated USING (true);


--
-- Name: stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

--
-- Name: stations stations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stations_read ON public.stations FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: stations stations_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stations_write ON public.stations TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: stock_alerts stock_alert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_alert_own ON public.stock_alerts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: stock_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_items stock_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_delete ON public.stock_items FOR DELETE TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: stock_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_items stock_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_read ON public.stock_items FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: stock_items stock_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_update ON public.stock_items FOR UPDATE TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id))) WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: stock_items stock_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_write ON public.stock_items FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: stock_movements stockmov_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stockmov_insert ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: stock_movements stockmov_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stockmov_read ON public.stock_movements FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: subscriptions sub_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_own ON public.subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_read ON public.suppliers FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: support_tickets support_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_customer ON public.support_tickets FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: support_tickets support_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_staff ON public.support_tickets FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_ledger wallet_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_read_own ON public.wallet_ledger FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: wastage_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wastage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: wastage_log wastage_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wastage_read ON public.wastage_log FOR SELECT TO authenticated USING (((org_id = public.current_org_id()) AND public.has_location(location_id)));


--
-- Name: winback_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.winback_log ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_zones zone_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zone_owner_write ON public.delivery_zones TO authenticated USING (((org_id = public.current_org_id()) AND public.is_org_owner())) WITH CHECK (((org_id = public.current_org_id()) AND public.is_org_owner()));


--
-- Name: delivery_zones zone_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zone_public_read ON public.delivery_zones FOR SELECT TO anon USING ((is_active AND public.is_storefront_org(org_id)));


--
-- Name: delivery_zones zone_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zone_staff_read ON public.delivery_zones FOR SELECT TO authenticated USING ((org_id = public.current_org_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict 6qGtetGcb8wTfi0g6hKHGp7qujZ1y9Ex9UIQ9Ky7ZB5YFlfNhkv3q9mdBDcweD5

