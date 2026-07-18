-- =====================================================================
-- Farmers Fresh — Migration 0005
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Two things:
--   A. place_order now RESERVES stock and refuses orders it cannot fill.
--   B. Security hardening, driven by the Supabase advisor.
-- =====================================================================

-- =====================================================================
-- PART A — Reservation
--
-- Before this, the site would cheerfully sell 20 kg of mutton that did not
-- exist. Reservation happens at PLACEMENT, not confirmation: the gap between
-- a customer pressing the button and staff seeing the order is exactly when
-- a second customer would oversell the same cut.
-- =====================================================================

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

  if regexp_replace(p_contact_phone, '\s|-|\+91', '', 'g') !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number.';
  end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then raise exception 'Your basket is empty.'; end if;
  if v_count > 40 then raise exception 'Too many items in one order.'; end if;

  -- Lock the ledger rows so two simultaneous customers cannot both pass the
  -- availability check on the same last kilo.
  perform 1 from public.stock_movements
   where location_id = v_loc
     and product_id in (select (l).product_id from unnest(p_lines) l)
   for update;

  -- Check EVERY line before writing anything. A partially-filled order is
  -- worse than a refused one.
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
    p_org_id, v_loc, v_number, trim(p_contact_name), trim(p_contact_phone),
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

-- Cancelling returns the meat to the shelf. This is why staff must cancel
-- through the function and not by setting status = 'cancelled' directly.
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; v_o record; v_it record;
begin
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

  update public.orders o set status = 'cancelled', cancelled_reason = p_reason
   where o.id = p_order_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_o.location_id, auth.uid(), 'order.cancelled', 'order', p_order_id,
          jsonb_build_object('order_number', v_o.order_number, 'reason', p_reason));
end $$;

-- =====================================================================
-- PART B — Hardening
--
-- 1. Trigger functions had a mutable search_path. A function without a
--    pinned search_path can be hijacked by a caller who creates a
--    same-named object in an earlier schema.
-- 2. Supabase grants EXECUTE on new public functions to anon+authenticated
--    BY DEFAULT, which had quietly re-exposed internal helpers over REST.
--    Note this means a `revoke` inside the same migration that creates the
--    function is not enough — it must come after, as it does here.
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.block_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'This table is append-only; % is not allowed', tg_op;
end $$;

-- Trigger functions must never be callable directly.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.block_mutation() from public, anon, authenticated;
revoke all on function public.recalc_sale_payment() from public, anon, authenticated;

-- Internal RLS helpers: used INSIDE policies, never called over the API.
revoke all on function public.current_org_id()   from public, anon;
revoke all on function public.is_org_owner()     from public, anon;
revoke all on function public.has_location(uuid) from public, anon;
grant execute on function public.current_org_id()   to authenticated;
grant execute on function public.is_org_owner()     to authenticated;
grant execute on function public.has_location(uuid) to authenticated;

-- An anonymous caller must not be able to probe card UIDs over
-- /rest/v1/rpc/resolve_card, nor confirm a guessed UID via the hash helper.
revoke all on function public.resolve_card(text) from public, anon;
grant execute on function public.resolve_card(text) to authenticated;
revoke all on function public.hash_card_uid(text) from public, anon, authenticated;

revoke all on function public.cancel_order(uuid,text) from public, anon;
grant execute on function public.cancel_order(uuid,text) to authenticated;

-- What the public IS allowed to call — exactly three things.
grant execute on function public.storefront_org_id() to anon, authenticated;
grant execute on function public.is_storefront_org(uuid) to anon, authenticated;
grant execute on function public.place_order(
  uuid,text,text,text,text,text,text,text,text,public.cart_line[]
) to anon, authenticated;
