-- Mobile-readiness: rules that lived in TypeScript move into the database, so the
-- website, a future mobile app and any direct API call all get the same behaviour.

-- 1. Order status changes -----------------------------------------------------
-- Before: staff could UPDATE orders.status directly to anything. Verified bugs:
--   * an unpaid online order (pending_payment) set to 'delivered' -> no payment,
--     and the reward trigger credited loyalty points;
--   * 'cancelled' set directly -> reserved stock never returned (cancel_order skipped).
-- Now: one function, forward-only along the fulfilment chain. Cancelling stays
-- cancel_order(); payment states are only changed by the payment functions.
create or replace function public.set_order_status(p_order_id uuid, p_to text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_o record;
  v_chain constant text[] := array['placed','confirmed','packed','out_for_delivery','delivered'];
  v_from int; v_new int;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  -- Same scope as the orders_update policy it replaces.
  if v_o.id is null or v_o.org_id is distinct from public.current_org_id()
     or not (public.is_org_owner() or public.has_location(v_o.location_id)) then
    raise exception 'Order not found.' using errcode = '42501';
  end if;

  v_from := array_position(v_chain, v_o.status);
  v_new  := array_position(v_chain, p_to);
  if v_from is null or v_new is null or v_new <= v_from then
    raise exception 'This order is % and can''t be moved to %.',
      replace(v_o.status, '_', ' '), replace(coalesce(p_to, 'that status'), '_', ' ');
  end if;

  update public.orders
     set status = p_to,
         confirmed_at = case when v_new >= 2 then coalesce(confirmed_at, now()) else confirmed_at end,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = p_order_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_o.org_id, v_o.location_id, auth.uid(), 'order.status_changed', 'order', p_order_id,
          jsonb_build_object('from', v_o.status, 'to', p_to));
end $$;

revoke all on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- Close the direct path.
revoke update (status, confirmed_at, delivered_at) on public.orders from authenticated;

-- 2. Subscriptions ----------------------------------------------------------------
-- Before: the website worked out the address, phone check and first delivery date,
-- then inserted the row itself — a mobile app would have had to copy all of it.
create or replace function public.create_subscription(p_product uuid, p_quantity numeric, p_frequency text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.storefront_org_id();
  v_name text; v_phone text; v_line text; v_city text; v_pin text; v_landmark text;
  v_pre jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in to subscribe.'); end if;
  if v_org is null then return jsonb_build_object('ok', false, 'message', 'The shop isn''t open.'); end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 50 then
    return jsonb_build_object('ok', false, 'message', 'Choose a quantity.');
  end if;
  if p_frequency is null or p_frequency not in ('daily', 'weekly', 'monthly') then
    return jsonb_build_object('ok', false, 'message', 'Choose a frequency.');
  end if;
  if not exists (select 1 from public.products where id = p_product and org_id = v_org and is_published) then
    return jsonb_build_object('ok', false, 'message', 'Product not found.');
  end if;

  -- Delivery details: default saved address, else the last order.
  select contact_name, contact_phone, address_line, city, pincode, landmark
    into v_name, v_phone, v_line, v_city, v_pin, v_landmark
    from public.customer_addresses where user_id = v_uid and is_default limit 1;
  if not found then
    v_pre := public.my_checkout_prefill();
    v_name := v_pre->>'name'; v_phone := v_pre->>'phone'; v_line := v_pre->>'address';
    v_city := nullif(v_pre->>'city', ''); v_pin := nullif(v_pre->>'pincode', '');
    v_landmark := nullif(v_pre->>'landmark', '');
  end if;

  v_phone := right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 10);
  if coalesce(trim(v_name), '') = '' or v_phone !~ '^[6-9][0-9]{9}$' or coalesce(trim(v_line), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Add a delivery address to your account first, then subscribe.');
  end if;

  insert into public.subscriptions (org_id, user_id, product_id, quantity, frequency, next_run,
                                    contact_name, contact_phone, address_line, city, pincode, landmark)
  values (v_org, v_uid, p_product, p_quantity, p_frequency, current_date + 1,
          trim(v_name), v_phone, trim(v_line), v_city, v_pin, v_landmark);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.create_subscription(uuid, numeric, text) from public, anon;
grant execute on function public.create_subscription(uuid, numeric, text) to authenticated;

-- Customers keep update/delete on their own rows (pause, resume, cancel); new ones go through the function.
revoke insert on public.subscriptions from anon, authenticated;
