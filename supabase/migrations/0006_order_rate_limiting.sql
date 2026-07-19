-- =====================================================================
-- Farmers Fresh — Migration 0006: Rate limiting on order placement
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- THE PROBLEM THIS SOLVES
-- `place_order` is callable by anyone, unauthenticated, and since migration
-- 0005 it RESERVES REAL STOCK. Pay-on-delivery means a fake order costs the
-- attacker nothing and costs you no money — but it does take meat off the
-- shelf. A loop could make the whole shop show "sold out" in under a minute.
--
-- Two limits, both keyed on phone number, since that is the only identity a
-- customer gives us:
--   1. At most 3 OPEN orders per phone at once.
--   2. At most 6 orders per phone per hour.
--
-- Deliberately generous — a family ordering for a function should never hit
-- these. They exist to stop a script, not to police customers.
--
-- CRITICAL DETAIL: the phone is normalised BEFORE both the limit check and
-- the insert. Without that, '9876543210' and '+91 98765 43210' look like two
-- different customers and the limit is bypassed by adding a space.
-- Verified: reformatting the number does NOT reset the counter.
--
-- The full function body lives here because Postgres has no "alter function
-- body" — see 0005 for the reservation logic this builds on.
-- =====================================================================

create index if not exists idx_orders_phone_recent
  on public.orders(contact_phone, placed_at desc);

create or replace function public.place_order(
  p_org_id        uuid,
  p_contact_name  text,
  p_contact_phone text,
  p_address_line  text,
  p_city          text,
  p_pincode       text,
  p_landmark      text,
  p_delivery_slot text,
  p_notes         text,
  p_lines         public.cart_line[]
)
returns table (order_id uuid, order_number text, total numeric)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_order_id uuid; v_number text;
  v_subtotal numeric(12,2) := 0; v_fee numeric(12,2) := 0;
  v_line public.cart_line; v_count int;
  v_loc uuid; v_on_hand numeric; v_name text;
  v_phone text; v_open int; v_recent int;
begin
  if not public.is_storefront_org(p_org_id) then
    raise exception 'This shop is not open.';
  end if;

  select o.storefront_location_id into v_loc
  from public.organizations o where o.id = p_org_id;
  if v_loc is null then
    raise exception 'This shop has no delivery store configured.';
  end if;

  if coalesce(trim(p_contact_name), '') = ''
     or coalesce(trim(p_contact_phone), '') = ''
     or coalesce(trim(p_address_line), '') = '' then
    raise exception 'Name, phone and address are required.';
  end if;

  v_phone := regexp_replace(p_contact_phone, '\s|-|\+91', '', 'g');
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number.';
  end if;

  select count(*) into v_open
  from public.orders o
  where o.org_id = p_org_id and o.contact_phone = v_phone
    and o.status not in ('delivered', 'cancelled');
  if v_open >= 3 then
    raise exception 'You already have % orders on the way. Please wait for those to arrive.', v_open;
  end if;

  select count(*) into v_recent
  from public.orders o
  where o.org_id = p_org_id and o.contact_phone = v_phone
    and o.placed_at > now() - interval '1 hour';
  if v_recent >= 6 then
    raise exception 'Too many orders from this number in the last hour. Please call us instead.';
  end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then raise exception 'Your basket is empty.'; end if;
  if v_count > 40 then raise exception 'Too many items in one order.'; end if;

  perform 1 from public.stock_movements
   where location_id = v_loc
     and product_id in (select (l).product_id from unnest(p_lines) l)
   for update;

  foreach v_line in array p_lines loop
    select p.name into v_name from public.products p
     where p.id = v_line.product_id and p.org_id = p_org_id
       and p.is_published and p.is_active and p.sale_price is not null;
    if v_name is null then
      raise exception 'One of those items is no longer available.';
    end if;

    v_on_hand := public.stock_available(v_loc, v_line.product_id);
    if v_on_hand < v_line.quantity then
      if v_on_hand <= 0 then
        raise exception '% is sold out.', v_name;
      else
        raise exception 'Only % kg of % left.', v_on_hand, v_name;
      end if;
    end if;
  end loop;

  v_number := public.next_order_number();

  insert into public.orders (
    org_id, location_id, order_number, contact_name, contact_phone,
    address_line, city, pincode, landmark, delivery_slot, notes
  ) values (
    p_org_id, v_loc, v_number, trim(p_contact_name), v_phone,
    trim(p_address_line), nullif(trim(coalesce(p_city,'')), ''),
    nullif(trim(coalesce(p_pincode,'')), ''), nullif(trim(coalesce(p_landmark,'')), ''),
    nullif(trim(coalesce(p_delivery_slot,'')), ''), nullif(trim(coalesce(p_notes,'')), '')
  ) returning orders.id into v_order_id;

  foreach v_line in array p_lines loop
    insert into public.order_items (order_id, product_id, product_name, unit, quantity, unit_price)
    select v_order_id, p.id, p.name, p.unit, v_line.quantity, p.sale_price
    from public.products p
    where p.id = v_line.product_id and p.org_id = p_org_id
      and p.is_published and p.is_active and p.sale_price is not null
      and v_line.quantity > 0 and v_line.quantity <= 50;

    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, note)
    values (p_org_id, v_loc, v_line.product_id, -v_line.quantity,
            'order_reserved', 'order', v_order_id, v_number);
  end loop;

  select coalesce(sum(oi.line_total), 0) into v_subtotal
  from public.order_items oi where oi.order_id = v_order_id;
  if v_subtotal <= 0 then
    raise exception 'None of those items are available right now.';
  end if;

  v_fee := case when v_subtotal >= 500 then 0 else 40 end;

  update public.orders o
     set subtotal = v_subtotal, delivery_fee = v_fee, total = v_subtotal + v_fee
   where o.id = v_order_id;

  insert into public.events (org_id, location_id, event_type, entity_type, entity_id, payload)
  values (p_org_id, v_loc, 'order.placed', 'order', v_order_id,
          jsonb_build_object('order_number', v_number, 'total', v_subtotal + v_fee));

  return query select v_order_id, v_number, (v_subtotal + v_fee)::numeric;
end $$;

revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[]) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[]) to anon, authenticated;
