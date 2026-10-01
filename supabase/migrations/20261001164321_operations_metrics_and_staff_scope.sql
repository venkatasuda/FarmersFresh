-- Restore the established capability seed, omitted by the schema-only baseline.
insert into public.role_capabilities(role,capability) values
('manager','catalogue.write'),('manager','inventory.adjust'),('manager','orders.manage'),
('manager','procurement.manage'),('manager','delivery.assign'),('manager','coupons.manage'),
('accountant','financials.read'),('staff','orders.manage'),('staff','delivery.assign')
on conflict do nothing;

drop policy returns_staff_read on public.returns;
create policy returns_staff_read on public.returns for select to authenticated using (
  org_id=public.current_org_id() and public.has_permission('orders.manage')
  and exists(select 1 from public.orders o where o.id=order_id and public.has_location(o.location_id))
);

create or replace function public.get_returns(p_all boolean default false)
returns setof public.returns language sql stable security definer set search_path='' as $$
  select r.* from public.returns r join public.orders o on o.id=r.order_id
  where r.org_id=public.current_org_id() and public.has_permission('orders.manage')
    and public.has_location(o.location_id) and (p_all or r.status='requested')
  order by r.created_at desc;
$$;

-- Counts only: no customer identifiers, payloads, credentials or error text.
create function public.operations_metrics() returns table(metric text,value bigint)
language sql stable security definer set search_path='' as $$
  select 'ff_stuck_orders',count(*) from public.orders
    where status in ('pending','confirmed','packed','out_for_delivery') and placed_at<now()-interval '24 hours'
  union all select 'ff_stale_unpaid_orders',count(*) from public.orders
    where status='pending_payment' and placed_at<now()-interval '45 minutes'
  union all select 'ff_pending_refunds',count(*) from public.orders where status='refund_pending'
  union all select 'ff_payment_exceptions_24h',count(*) from public.payment_events
    where status in ('amount_mismatch','unmatched') and created_at>now()-interval '24 hours'
  union all select 'ff_failed_notifications_24h',count(*) from public.notifications
    where status='failed' and created_at>now()-interval '24 hours'
  union all select 'ff_skipped_notifications_24h',count(*) from public.notifications
    where status='skipped' and created_at>now()-interval '24 hours'
  union all select 'ff_stuck_notifications',count(*) from public.notifications
    where (status='pending' and created_at<now()-interval '15 minutes')
       or (status='sending' and claimed_at<now()-interval '5 minutes')
  union all select 'ff_low_stock_products',count(*) from public.products p
    join public.organizations o on o.id=p.org_id
    where o.storefront_enabled and p.is_active and p.is_published
      and public.stock_available(o.storefront_location_id,p.id)<=5;
$$;
revoke all on function public.operations_metrics() from public,anon,authenticated;
grant execute on function public.operations_metrics() to service_role;


CREATE OR REPLACE FUNCTION public.reject_return(p_id uuid, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_r record;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_r from public.returns where id = p_id and org_id = v_org for update;
  if v_r.id is null then raise exception 'Return not found.'; end if;
  if not exists(select 1 from public.orders o where o.id=v_r.order_id and public.has_location(o.location_id)) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if v_r.status <> 'requested' then raise exception 'This request is already resolved.'; end if;

  update public.returns
     set status = 'rejected', staff_note = nullif(trim(coalesce(p_note,'')),''),
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
  insert into public.events(org_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,auth.uid(),'return.rejected','return',p_id);
end $$;

CREATE OR REPLACE FUNCTION public.instant_refund(p_order_id uuid, p_points numeric, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_org uuid; v_o record;
begin
  perform public.require_permission('orders.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select * into v_o from public.orders where id = p_order_id and org_id = v_org for update;
  if v_o.id is null then raise exception 'Order not found.'; end if;
  if not public.has_location(v_o.location_id) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if v_o.user_id is null then return jsonb_build_object('ok', false, 'message', 'This order has no account to refund points to.'); end if;
  if not (coalesce(p_points,0) > 0) then return jsonb_build_object('ok', false, 'message', 'Enter an amount.'); end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_o.user_id, p_points, 'refund', v_o.order_number);
  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), 'order.refunded', 'order', p_order_id,
          jsonb_build_object('points', p_points, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;
