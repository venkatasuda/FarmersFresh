-- Ledger guards cover checkout, POS, subscriptions and every other writer.
-- Transaction locks also work when an account/item has no ledger rows yet.
create or replace function public.guard_stock_balance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_balance numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'stock:' || new.location_id::text || ':' || new.product_id::text, 0));
  if not exists (select 1 from public.locations where id = new.location_id and org_id = new.org_id)
     or not exists (select 1 from public.products where id = new.product_id and org_id = new.org_id) then
    raise exception 'Stock must belong to the same organization.' using errcode = '23514';
  end if;
  if new.delta < 0 then
    select coalesce(sum(delta), 0) into v_balance from public.stock_movements
      where location_id = new.location_id and product_id = new.product_id;
    if v_balance + new.delta < 0 then
      raise exception 'Insufficient stock.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger trg_stock_balance before insert on public.stock_movements
for each row execute function public.guard_stock_balance();
revoke all on function public.guard_stock_balance() from public, anon, authenticated;

create or replace function public.guard_wallet_balance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_balance numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'wallet:' || new.org_id::text || ':' || new.user_id::text, 0));
  if new.amount < 0 then
    select coalesce(sum(amount), 0) into v_balance from public.wallet_ledger
      where org_id = new.org_id and user_id = new.user_id;
    if v_balance + new.amount < 0 then
      raise exception 'Insufficient wallet points.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger trg_wallet_balance before insert on public.wallet_ledger
for each row execute function public.guard_wallet_balance();
revoke all on function public.guard_wallet_balance() from public, anon, authenticated;


CREATE OR REPLACE FUNCTION public.run_one_subscription(p_sub uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  s record; v_loc uuid; v_price numeric(12,2); v_on_hand numeric;
  v_order uuid; v_number text; v_total numeric(12,2); v_fee numeric(12,2); v_step interval;
  v_pct numeric(5,2); v_discount numeric(12,2); v_grand numeric(12,2);
begin
  select * into s from public.subscriptions where id = p_sub and is_active
    and next_run <= (now() at time zone 'Asia/Kolkata')::date for update;
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'stock:' || v_loc::text || ':' || s.product_id::text, 0));
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
  select case when v_total >= free_delivery_threshold then 0 else delivery_fee end
    into v_fee from public.organizations where id = s.org_id;

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

CREATE OR REPLACE FUNCTION public.approve_return(p_id uuid, p_refund_points numeric DEFAULT 0, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_r record; v_pts numeric;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_r from public.returns where id = p_id and org_id = v_org for update;
  if v_r.id is null then raise exception 'Return not found.'; end if;
  if not exists (select 1 from public.orders o where o.org_id = v_org
    and o.order_number = v_r.order_number and public.has_location(o.location_id)) then
    raise exception 'Access denied.' using errcode = '42501';
  end if;
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

CREATE OR REPLACE FUNCTION public.tip_delivery(p_number text, p_points integer) RETURNS jsonb
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'wallet:' || v_o.org_id::text || ':' || v_uid::text, 0));
  if (select coalesce(sum(amount),0) from public.wallet_ledger
      where org_id = v_o.org_id and user_id = v_uid) < p_points then
    return jsonb_build_object('ok', false, 'message', 'Not enough points for that tip.');
  end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_o.org_id, v_uid, -p_points, 'tip', v_o.order_number);
  update public.orders set tip_points = tip_points + p_points where id = v_o.id;
  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_o.org_id, v_o.location_id, v_uid, 'order.tipped', 'order', v_o.id,
    jsonb_build_object('points', p_points));
  return jsonb_build_object('ok', true, 'tip', p_points);
end $$;
