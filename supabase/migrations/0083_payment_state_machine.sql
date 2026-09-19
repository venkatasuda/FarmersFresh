-- =====================================================================
-- Migration 0083: payment settlement / stale-cancellation state machine.
-- Before: neither function locked the order, so the stale-cleaner could cancel
-- and release stock while mark_order_paid independently set is_paid=true,
-- producing a silent "cancelled + paid" (worst case: released stock re-sold).
-- Now both take a row lock on the same order; the cleaner uses SKIP LOCKED so
-- it never fights a settling webhook, and a late payment becomes a deliberate,
-- flagged state (order.paid_after_cancel) for reconciliation instead of silently
-- re-opening the order. Applied live to bjevoybwufubtprkxbvb.
-- =====================================================================
create or replace function public.cancel_stale_unpaid_orders()
returns integer language plpgsql security definer set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.mark_order_paid(p_order_id uuid, p_razorpay_order text, p_razorpay_payment text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_o record; v_notify_email text; v_notify_phone text; v_items text;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'Order not found.'; end if;
  v_org := v_o.org_id;

  if v_o.is_paid then return; end if;

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
end $function$;
