-- VEN-5: a payment that lands after the stale-order cleaner cancelled the order
-- left it 'cancelled' + paid with nothing prompting a refund.
-- Now it becomes 'refund_pending' (shows in the staff Open orders list).
-- Staff refund in Razorpay, then "Mark refunded" -> cancel_order(), which
-- skips the stock release for refund_pending (stock was already released).

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (status = any (array[
  'pending_payment','placed','confirmed','packed','out_for_delivery','delivered','cancelled','refund_pending']));

CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid, p_razorpay_order text, p_razorpay_payment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       set is_paid = true, status = 'refund_pending', razorpay_order_id = p_razorpay_order,
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

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- refund_pending: stock was already released when the order expired.
  if v_o.status <> 'refund_pending' then
  for v_it in select * from public.order_items oi where oi.order_id = p_order_id loop
    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note)
    values (v_org, v_o.location_id, v_it.product_id, v_it.quantity,
            'order_released', 'order', p_order_id, auth.uid(), v_o.order_number);
  end loop;
  end if;

  update public.orders o
     set status = 'cancelled', cancelled_reason = p_reason
   where o.id = p_order_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_o.location_id, auth.uid(), 'order.cancelled', 'order', p_order_id,
          jsonb_build_object('order_number', v_o.order_number, 'reason', p_reason));
end $function$;
