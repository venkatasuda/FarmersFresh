-- =====================================================================
-- Farmers Fresh — Migration 0016: Customer notifications
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- The customer gets messages at two moments, into the same outbox (0011):
--   1. Order confirmed — fired when place_order sets the total (0 -> final),
--      so the message carries the real amount.
--   2. Status changes to confirmed / out_for_delivery / delivered / cancelled.
--
-- Done as a TRIGGER, not app code, so it fires however the order was changed
-- (storefront, staff queue, future admin). Customers gave a phone not an
-- email, so these go to sms + whatsapp only. Verified end to end.
-- =====================================================================

create or replace function public.enqueue_customer_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text; v_items text;
begin
  if coalesce(old.total,0) = 0 and coalesce(new.total,0) > 0 then
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

  return new;
end $$;

-- Trigger functions must never be callable directly over the API.
revoke all on function public.enqueue_customer_notification() from public, anon, authenticated;

drop trigger if exists trg_order_customer_notify on public.orders;
create trigger trg_order_customer_notify
  after update on public.orders
  for each row execute function public.enqueue_customer_notification();
