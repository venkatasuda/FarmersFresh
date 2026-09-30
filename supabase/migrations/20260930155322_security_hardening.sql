-- Application request budgets: only the trusted server may consume counters.
create table public.request_limits (
  key text primary key check (length(key) = 64),
  window_start timestamptz not null,
  hits integer not null
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public, anon, authenticated;
create function public.consume_request_limit(p_key text, p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits integer; v_window timestamptz := date_trunc('minute', clock_timestamp());
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then raise exception 'Invalid request limit.'; end if;
  delete from public.request_limits where window_start < v_window - interval '2 minutes';
  insert into public.request_limits(key, window_start, hits) values(p_key, v_window, 1)
  on conflict(key) do update set
    hits = case when request_limits.window_start = v_window then least(request_limits.hits + 1, p_limit + 1) else 1 end,
    window_start = v_window returning hits into v_hits;
  return v_hits <= p_limit;
end $$;
revoke all on function public.consume_request_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_request_limit(text, integer) to service_role;

-- Public delivery; only the validated server pipeline writes product images.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy validated_product_image_insert on storage.objects as restrictive for insert to anon, authenticated
with check (bucket_id <> 'product-images');
create policy validated_product_image_update on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'product-images') with check (bucket_id <> 'product-images');
create policy validated_product_image_delete on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id <> 'product-images');

-- One transaction: an invalid line must roll back the header and every item.
create function public.create_purchase_order_with_items(p_location uuid, p_supplier uuid, p_notes text, p_items jsonb, p_mark_ordered boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_po jsonb; v_item jsonb;
begin
  perform public.require_permission('procurement.manage');
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid items.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Add between 1 and 100 items.'; end if;
  if p_supplier is not null and not exists(select 1 from public.suppliers where id = p_supplier and org_id = public.current_org_id()) then raise exception 'Supplier not found.'; end if;
  if length(p_notes) > 2000 then raise exception 'Notes are too long.'; end if;
  v_po := public.create_purchase_order(p_location, p_supplier, p_notes);
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item->>'qty') is null or (v_item->>'unitCost') is null
       or not ((v_item->>'qty')::numeric > 0 and (v_item->>'qty')::numeric <= 100000)
       or not ((v_item->>'unitCost')::numeric >= 0 and (v_item->>'unitCost')::numeric <= 10000000)
       then raise exception 'Invalid quantity or cost.'; end if;
    perform public.add_po_item((v_po->>'id')::uuid, (v_item->>'productId')::uuid, (v_item->>'qty')::numeric, (v_item->>'unitCost')::numeric);
  end loop;
  if p_mark_ordered then perform public.mark_po_ordered((v_po->>'id')::uuid); end if;
  insert into public.events(org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values(public.current_org_id(), p_location, auth.uid(), 'purchase_order.created', 'purchase_order', (v_po->>'id')::uuid, jsonb_build_object('items', jsonb_array_length(p_items)));
  return v_po;
end $$;
revoke all on function public.create_purchase_order_with_items(uuid,uuid,text,jsonb,boolean) from public, anon;
grant execute on function public.create_purchase_order_with_items(uuid,uuid,text,jsonb,boolean) to authenticated;

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

  select * into v_o from public.orders o where o.id = p_order_id and o.org_id = v_org for update;
  if v_o is null then raise exception 'Order not found.'; end if;
  if not public.has_location(v_o.location_id) then raise exception 'Insufficient permissions.' using errcode = '42501'; end if;
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

CREATE OR REPLACE FUNCTION public.settle_razorpay_payment(p_payment_id text, p_rp_order text, p_amount integer, p_event text, p_raw jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_order record; v_mem record; v_status text; v_org uuid; v_target text; v_tid uuid;
begin
  if coalesce(p_payment_id,'') = '' or coalesce(p_rp_order,'') = '' or p_event is distinct from 'payment.captured' then raise exception 'Invalid captured payment.'; end if;

  -- Idempotency gate: first writer wins; a replay finds the row and stops.
  insert into public.payment_events (razorpay_payment_id, razorpay_order_id, amount, event, raw)
  values (p_payment_id, p_rp_order, p_amount, p_event, p_raw)
  on conflict (razorpay_payment_id) do nothing;
  if not found then return 'duplicate'; end if;

  select id, total, org_id into v_order from public.orders where razorpay_order_id = p_rp_order limit 1;
  if v_order.id is not null then
    if p_amount is null or p_amount <= 0 or p_amount <> round(v_order.total * 100) then
      v_status := 'amount_mismatch';                 -- never settle a mismatched amount
    else
      perform public.mark_order_paid(v_order.id, p_rp_order, p_payment_id);
      v_status := 'order_paid';
    end if;
    v_target := 'order'; v_tid := v_order.id; v_org := v_order.org_id;
  else
    select id, org_id, amount into v_mem from public.pass_memberships where razorpay_order_id = p_rp_order limit 1;
    if v_mem.id is not null then
      if p_amount is null or p_amount <= 0 or p_amount <> round(v_mem.amount * 100) then
        v_status := 'amount_mismatch';
      else
        perform public.activate_membership(v_mem.id, p_rp_order, p_payment_id);
        v_status := 'membership_activated';
      end if;
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
CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit integer DEFAULT 25) RETURNS TABLE(id bigint, channel text, recipient text, template text, payload jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.notifications n
     set status = 'sending', claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select c.id from public.notifications c
      where c.attempts < 5 and (c.status = 'pending'
         or (c.status = 'failed' and c.claimed_at < now() - interval '5 minutes')
         or (c.status = 'sending' and c.claimed_at < now() - interval '15 minutes'))
      order by c.created_at
      for update skip locked
      limit least(greatest(coalesce(p_limit, 25), 1), 100)
   )
  returning n.id, n.channel, n.recipient, n.template, n.payload;
$$;
-- Prevent direct table/RPC writes from turning the privileged worker into an SSRF proxy.
alter table public.push_subscriptions add constraint trusted_push_endpoint check (
  endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]]+$'
  and length(endpoint) <= 2048
) not valid;

-- An owner belongs to one organization, not every location in the database.
create or replace function public.has_location(loc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.locations l
    where l.id = loc and l.org_id = public.current_org_id()
      and (public.is_org_owner() or exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.location_id = l.id and m.org_id = l.org_id
      ))
  );
$$;
