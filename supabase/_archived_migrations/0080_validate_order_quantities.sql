-- =====================================================================
-- Migration 0080: P0 — validate aggregated order quantities.
-- The reservation loop used -v_line.quantity directly, so a hand-crafted RPC
-- call with a NEGATIVE quantity became a POSITIVE stock reservation (creating
-- stock), and a qty > 50 depleted stock with no matching order line (the item
-- insert filters > 50 but the movement didn't). We reject any invalid
-- aggregated quantity right after consolidation, before anything touches stock.
-- Full body reproduced (supersedes 0079). Applied live to bjevoybwufubtprkxbvb.
-- =====================================================================
create or replace function public.place_order(
  p_org_id uuid, p_contact_name text, p_contact_phone text, p_address_line text,
  p_city text, p_pincode text, p_landmark text, p_delivery_slot text, p_notes text,
  p_lines cart_line[], p_contact_email text default null, p_coupon_code text default null,
  p_use_credit boolean default false, p_payment_method text default 'cod')
returns table(order_id uuid, order_number text, total numeric)
language plpgsql security definer set search_path to 'public'
as $function$
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
      where org_id = p_org_id and upper(code) = upper(v_coupon);
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
end $function$;