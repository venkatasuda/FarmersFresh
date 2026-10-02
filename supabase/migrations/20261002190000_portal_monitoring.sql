-- Counts only, evaluated with the caller's organization and manager assignments.
create function public.portal_operations_metrics() returns table(metric text,value bigint)
language plpgsql stable security definer set search_path='' as $$
declare
  v_org uuid := public.current_org_id();
  v_owner boolean := coalesce(public.is_org_owner(),false);
begin
  if v_org is null or not (v_owner or exists (
    select 1 from public.memberships m join public.locations l on l.id=m.location_id
    where m.user_id=auth.uid() and m.org_id=v_org and l.org_id=v_org
      and m.role='manager' and l.type='store'
  )) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  return query
  with stores as (
    select l.id from public.locations l where l.org_id=v_org and l.type='store'
      and (v_owner or exists(select 1 from public.memberships m
        where m.location_id=l.id and m.org_id=v_org and m.user_id=auth.uid() and m.role='manager'))
  ), orders as (
    select o.* from public.orders o where o.org_id=v_org
      and (v_owner or o.location_id in (select id from stores))
  ), notifications as (
    select n.* from public.notifications n where n.org_id=v_org
      and (v_owner or exists(select 1 from orders o where o.order_number=n.payload->>'order_number'))
  )
  select 'ff_stuck_orders',count(*) from orders
    where status in ('placed','confirmed','packed','out_for_delivery') and placed_at<now()-interval '24 hours'
  union all select 'ff_stale_unpaid_orders',count(*) from orders
    where status='pending_payment' and placed_at<now()-interval '45 minutes'
  union all select 'ff_pending_refunds',count(*) from orders where status='refund_pending'
  union all select 'ff_payment_exceptions_24h',count(*) from public.payment_events p
    where p.org_id=v_org and p.status in ('amount_mismatch','unmatched') and p.created_at>now()-interval '24 hours'
      and (v_owner or (p.target_type='order' and exists(select 1 from orders o where o.id=p.target_id)))
  union all select 'ff_failed_notifications_24h',count(*) from notifications
    where status='failed' and created_at>now()-interval '24 hours'
  union all select 'ff_skipped_notifications_24h',count(*) from notifications
    where status='skipped' and created_at>now()-interval '24 hours'
  union all select 'ff_stuck_notifications',count(*) from notifications
    where (status='pending' and created_at<now()-interval '15 minutes')
       or (status='sending' and claimed_at<now()-interval '5 minutes')
  union all select 'ff_low_stock_products',count(*) from public.products p cross join stores s
    where p.org_id=v_org and p.is_active and p.is_published and public.stock_available(s.id,p.id)<=5;
end;
$$;
revoke all on function public.portal_operations_metrics() from public,anon;
grant execute on function public.portal_operations_metrics() to authenticated;

-- Checkout creates 'placed', not 'pending': monitor the actual open-order state.
create or replace function public.operations_metrics() returns table(metric text,value bigint)
language sql stable security definer set search_path='' as $$
  select 'ff_stuck_orders',count(*) from public.orders
    where status in ('placed','confirmed','packed','out_for_delivery') and placed_at<now()-interval '24 hours'
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
