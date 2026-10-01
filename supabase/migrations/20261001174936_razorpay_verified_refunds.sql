-- One full original-payment refund per cancelled order. Partial return credits
-- remain a separate wallet workflow; they cannot mark provider money refunded.
create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  org_id uuid not null references public.organizations(id),
  location_id uuid not null references public.locations(id),
  payment_id text not null unique check (payment_id ~ '^pay_[A-Za-z0-9]+$'),
  amount integer not null check (amount >= 100),
  provider_id text unique check (provider_id ~ '^rfnd_[A-Za-z0-9]+$'),
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_refunds_org_idx on public.payment_refunds(org_id);
alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;
grant select on public.payment_refunds to authenticated;
create policy payment_refunds_staff_read on public.payment_refunds for select to authenticated
using (org_id=public.current_org_id() and public.has_permission('orders.manage') and public.has_location(location_id));

create function public.request_order_refund(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_refund public.payment_refunds;
begin
  perform public.require_permission('orders.manage');
  select * into v_order from public.orders where id=p_order_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Order not found.' using errcode='42501'; end if;
  if not public.has_location(v_order.location_id) then raise exception 'Insufficient permissions.' using errcode='42501'; end if;
  if not v_order.is_paid or v_order.status not in ('cancelled','refund_pending') then raise exception 'Cancel the paid order before refunding.'; end if;
  if coalesce(v_order.razorpay_payment_id,'') !~ '^pay_[A-Za-z0-9]+$' then raise exception 'No provider payment to refund.'; end if;
  select * into v_refund from public.payment_refunds where order_id=p_order_id;
  if found then return to_jsonb(v_refund); end if;
  insert into public.payment_refunds(order_id,org_id,location_id,payment_id,amount,actor_id)
  values(v_order.id,v_order.org_id,v_order.location_id,v_order.razorpay_payment_id,round(v_order.total*100)::integer,auth.uid()) returning * into v_refund;
  update public.orders set status='refund_pending' where id=p_order_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
  values(v_order.org_id,v_order.location_id,auth.uid(),'order.refund_requested','order',v_order.id,
    jsonb_build_object('refund_id',v_refund.id,'amount',v_refund.amount));
  return to_jsonb(v_refund);
end $$;
revoke all on function public.request_order_refund(uuid) from public,anon;
grant execute on function public.request_order_refund(uuid) to authenticated;

create function public.record_order_refund(p_refund_id text,p_payment_id text,p_amount integer,p_status text) returns text
language plpgsql security definer set search_path=public as $$
declare v_refund public.payment_refunds;
begin
  if coalesce(p_refund_id,'') !~ '^rfnd_[A-Za-z0-9]+$' or coalesce(p_payment_id,'') !~ '^pay_[A-Za-z0-9]+$'
    or p_amount is null or p_amount<100 or p_status is null or p_status not in ('pending','processed','failed') then raise exception 'Invalid refund.'; end if;
  -- Lock orders first, consistently with request/cancellation, to avoid a lock inversion.
  perform 1 from public.orders where id=(select order_id from public.payment_refunds where payment_id=p_payment_id) for update;
  select * into v_refund from public.payment_refunds where payment_id=p_payment_id for update;
  if not found then return 'untracked'; end if;
  if v_refund.amount<>p_amount or (v_refund.provider_id is not null and v_refund.provider_id<>p_refund_id) then raise exception 'Refund mismatch.'; end if;
  if v_refund.status='processed' or (v_refund.provider_id=p_refund_id and v_refund.status=p_status)
    or (v_refund.status='failed' and p_status='pending') then return v_refund.status; end if;
  update public.payment_refunds set provider_id=p_refund_id,status=p_status,updated_at=now() where id=v_refund.id;
  if p_status='processed' then update public.orders set status='cancelled' where id=v_refund.order_id; end if;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
  values(v_refund.org_id,v_refund.location_id,v_refund.actor_id,'order.refund_'||p_status,'order',v_refund.order_id,
    jsonb_build_object('refund_id',p_refund_id,'amount',p_amount));
  return p_status;
end $$;
revoke all on function public.record_order_refund(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_order_refund(text,text,integer,text) to service_role;

-- Reuse the existing stock release, but never let a staff click pretend that
-- original-payment money was returned. Provider confirmation finishes the refund.
alter function public.cancel_order(uuid,text) rename to cancel_order_before_refunds;
revoke all on function public.cancel_order_before_refunds(uuid,text) from public,anon,authenticated;
create function public.cancel_order(p_order_id uuid,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v_order public.orders;
begin
  perform public.require_permission('orders.manage');
  select * into v_order from public.orders where id=p_order_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Order not found.' using errcode='42501'; end if;
  if not public.has_location(v_order.location_id) then raise exception 'Insufficient permissions.' using errcode='42501'; end if;
  if v_order.status in ('cancelled','refund_pending') then return; end if;
  perform public.cancel_order_before_refunds(p_order_id,p_reason);
  if v_order.is_paid and v_order.razorpay_payment_id is not null then
    update public.orders set status='refund_pending' where id=p_order_id;
    insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(v_order.org_id,v_order.location_id,auth.uid(),'order.refund_required','order',p_order_id,'{}');
  end if;
end $$;
revoke all on function public.cancel_order(uuid,text) from public,anon;
grant execute on function public.cancel_order(uuid,text) to authenticated;
