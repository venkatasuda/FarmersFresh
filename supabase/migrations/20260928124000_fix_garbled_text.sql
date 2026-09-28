-- VEN-11: these function bodies had double-encoded UTF-8 (â€” for —, Ã— for ×)
-- from the PowerShell rebaseline, so customers saw 'Thanks â€” we've got…'.
-- CREATE OR REPLACE keeps grants. Safe to run even if prod was never garbled.

CREATE OR REPLACE FUNCTION public.apply_markdown(p_product uuid, p_price numeric, p_ends date, p_reason text DEFAULT 'short_dated'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.log_wastage(p_location uuid, p_product uuid, p_qty numeric, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.record_sale(p_location uuid, p_customer_id uuid, p_lines sale_line[], p_method text, p_amount_paid numeric, p_note text DEFAULT NULL::text, p_loyalty_user uuid DEFAULT NULL::uuid, p_points_redeem numeric DEFAULT 0)
 RETURNS TABLE(sale_id uuid, total numeric, change numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.write_off_batch(p_batch uuid, p_reason text DEFAULT 'expiry'::text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.place_order(p_org_id uuid, p_contact_name text, p_contact_phone text, p_address_line text, p_city text, p_pincode text, p_landmark text, p_delivery_slot text, p_notes text, p_lines cart_line[], p_contact_email text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_use_credit boolean DEFAULT false, p_payment_method text DEFAULT 'cod'::text)
 RETURNS TABLE(order_id uuid, order_number text, total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.create_support_ticket(p_subject text, p_message text, p_order_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.rate_delivery(p_number text, p_phone text, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.request_return(p_number text, p_reason text, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.watch_stock(p_product uuid, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;
