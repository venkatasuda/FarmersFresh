insert into public.role_capabilities(role,capability) values('manager','operations.read') on conflict do nothing;
revoke insert,update,delete on public.memberships from anon,authenticated;
alter policy mem_read on public.memberships using(org_id=public.current_org_id() and (public.is_org_owner() or user_id=auth.uid()));
alter policy orders_read on public.orders using(org_id=public.current_org_id() and (public.is_org_owner() or public.has_location_permission(location_id,'orders.manage') or (assigned_to=auth.uid() and public.has_location_permission(location_id,'delivery.assign'))));

create function public.staff_access_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_org_owner() then raise exception 'Access denied.' using errcode='42501'; end if;
  return jsonb_build_object(
    'people',coalesce((select jsonb_agg(x) from(select id,full_name,is_owner from public.profiles where org_id=public.current_org_id() order by full_name,id) x),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(x) from(select id,name,type from public.locations where org_id=public.current_org_id() order by name,id) x),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(x) from(select user_id,location_id,role from public.memberships where org_id=public.current_org_id() order by user_id,location_id) x),'[]'::jsonb),
    'capabilities',coalesce((select jsonb_agg(x) from(select role,capability from public.role_capabilities where role in ('manager','staff','accountant') order by role,capability) x),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(x) from(select id,actor_id,entity_id,event_type,created_at,payload from public.events where org_id=public.current_org_id() and event_type in ('staff.access_changed','staff.owner_changed') order by created_at desc,id desc limit 100) x),'[]'::jsonb));
end $$;
create function public.set_staff_access(p_user uuid,p_location uuid,p_role text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_old text; v_org uuid:=public.current_org_id();
begin
  if auth.uid() is null or not public.is_org_owner() then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_user=auth.uid() then raise exception 'You cannot change your own access.'; end if;
  if p_role is not null and p_role not in ('manager','staff','accountant') then raise exception 'Choose a supported staff role.'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 or length(p_reason)>500 then raise exception 'Give an access reason within 500 characters.'; end if;
  -- ponytail: serialize access changes per organization; split by member if bulk provisioning needs higher throughput.
  perform pg_advisory_xact_lock(hashtextextended('staff-access:'||v_org::text,0));
  if not exists(select 1 from public.profiles where id=p_user and org_id=v_org and not is_owner)
    or not exists(select 1 from public.locations where id=p_location and org_id=v_org) then raise exception 'Access denied.' using errcode='42501'; end if;
  select role into v_old from public.memberships where user_id=p_user and location_id=p_location;
  if v_old is not distinct from p_role then return; end if;
  if p_role is null or p_role='accountant' then
    if exists(select 1 from public.orders where org_id=v_org and location_id=p_location and assigned_to=p_user and status in ('confirmed','packed','out_for_delivery')) then raise exception 'Reassign active deliveries before removing access.'; end if;
  end if;
  if p_role is null then delete from public.memberships where user_id=p_user and location_id=p_location and org_id=v_org;
  else
    insert into public.memberships(org_id,user_id,location_id,role) values(v_org,p_user,p_location,p_role)
      on conflict(user_id,location_id) do update set role=excluded.role,on_shift=false;
  end if;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(v_org,p_location,auth.uid(),'staff.access_changed','profile',p_user,jsonb_build_object('before',v_old,'after',p_role,'reason',btrim(p_reason)));
end $$;
create or replace function public.set_member_owner(p_user uuid,p_is_owner boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_old boolean; v_org uuid:=public.current_org_id();
begin
  if auth.uid() is null or not public.is_org_owner() then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_user=auth.uid() or p_is_owner is null then raise exception 'You cannot change your own owner status.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-access:'||v_org::text,0));
  select is_owner into v_old from public.profiles where id=p_user and org_id=v_org for update;
  if not found then raise exception 'Access denied.' using errcode='42501'; end if;
  if v_old=p_is_owner then return; end if;
  update public.profiles set is_owner=p_is_owner,updated_at=clock_timestamp() where id=p_user;
  insert into public.events(org_id,actor_id,event_type,entity_type,entity_id,payload)
    values(v_org,auth.uid(),'staff.owner_changed','profile',p_user,jsonb_build_object('before',v_old,'after',p_is_owner));
end $$;

-- Keep wallet compensation under the same store permission and cumulative order limit as cash.
create or replace function public.guard_cash_wallet_refund() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if new.reason='refund' then
    -- Trusted database restore preserves historical ledgers; client/service sessions cannot use this exception.
    if auth.uid() is null and session_user in ('postgres','supabase_admin') then return new; end if;
    select * into o from public.orders where org_id=new.org_id and order_number=new.ref for update;
    if o.id is null or auth.uid() is null or not public.has_location_permission(o.location_id,'cash.refund') then raise exception 'Access denied.' using errcode='42501'; end if;
    if exists(select 1 from public.cash_refunds where order_id=o.id) then raise exception 'This order already has a cash refund.'; end if;
    if not o.is_paid or o.status<>'delivered' then raise exception 'Only paid delivered orders can receive return compensation.'; end if;
    if new.user_id is distinct from o.user_id or not(new.amount>0 and new.amount<=10000000) or new.amount<>round(new.amount,2)
      or new.amount+(select coalesce(sum(amount),0) from public.wallet_ledger where org_id=o.org_id and ref=o.order_number and reason='refund')>o.total then raise exception 'Refund exceeds collected payment.'; end if;
  end if;
  return new;
end $$;
-- Fix the shared RPCs, so direct callers cannot combine roles from different stores.
do $$
declare v_definition text; v_signature text; v_source text;
begin
  for v_signature,v_source in select * from(values
    ('public.record_sale(uuid,uuid,public.sale_line[],text,numeric,text,uuid,numeric)','public.has_location(p_location)'),
    ('public.approve_return(uuid,numeric,text)','public.has_location(o.location_id)'),
    ('public.reject_return(uuid,text)','public.has_location(o.location_id)'),
    ('public.instant_refund(uuid,numeric,text)','public.has_location(v_o.location_id)')) x loop
    v_definition:=pg_get_functiondef(v_signature::regprocedure);
    if position(v_source in v_definition)=0 then raise exception 'Staff scope source changed; review migration.'; end if;
    v_definition:=replace(v_definition,'raise exception ''You do not have access to that till.'';','raise exception ''Access denied.'' using errcode=''42501'';');
    if v_signature='public.instant_refund(uuid,numeric,text)' then
      v_definition:=replace(v_definition,'insert into public.wallet_ledger',
        'if not(p_points>0 and p_points<=10000000) or p_points<>round(p_points,2) then raise exception ''Refund exceeds collected payment.''; end if; insert into public.wallet_ledger');
    elsif v_signature='public.approve_return(uuid,numeric,text)' then
      v_definition:=replace(v_definition,'v_pts := greatest',
        'if not(coalesce(p_refund_points,0)>=0 and coalesce(p_refund_points,0)<=10000000) or coalesce(p_refund_points,0)<>round(coalesce(p_refund_points,0),2) then raise exception ''Refund exceeds collected payment.''; end if; v_pts := greatest');
    end if;
    execute replace(v_definition,v_source,replace(left(v_source,length(v_source)-1),'has_location(','has_location_permission(')||',''orders.manage'')');
  end loop;
end $$;
revoke all on function public.staff_access_overview(),public.set_staff_access(uuid,uuid,text,text) from public,anon;
grant execute on function public.staff_access_overview(),public.set_staff_access(uuid,uuid,text,text) to authenticated;

create function public.manager_dashboard(p_location uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_stores uuid[]; v_org uuid:=public.current_org_id();
begin
  select coalesce(array_agg(id),'{}'::uuid[]) into v_stores from public.locations where org_id=v_org and type='store' and public.has_location_permission(id,'operations.read');
  if auth.uid() is null or (not public.is_org_owner() and cardinality(v_stores)=0) or (p_location is not null and not(p_location=any(v_stores))) then raise exception 'Access denied.' using errcode='42501'; end if;
  -- ponytail: live stock aggregation across permitted stores; cache rollups if a measured catalogue/branch load makes this slow.
  return jsonb_build_object(
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.locations where id=any(v_stores)),'[]'::jsonb),
    'stores',coalesce((select jsonb_agg(x) from(select l.id,l.name,
      (select count(*) from public.orders o where o.location_id=l.id and o.status in ('placed','confirmed','packed','out_for_delivery') and o.placed_at<clock_timestamp()-interval '30 minutes') overdue,
      (select count(*) from public.orders o where o.location_id=l.id and o.status in ('placed','confirmed','packed','out_for_delivery')) open_orders,
      (select count(*) from public.orders o where o.location_id=l.id and o.delivery_failure_note is not null and o.status='out_for_delivery') failed_deliveries,
      (select count(*) from public.orders o where o.location_id=l.id and o.status='delivered' and o.payment_method='cod' and not o.is_paid and o.total>0) uncollected_cod,
      (select count(*) from public.products p where p.org_id=v_org and p.is_active and p.is_published and public.stock_available(l.id,p.id)<=5) low_stock,
      (select count(*) from public.product_batches b where b.location_id=l.id and b.status in ('active','expired') and b.remaining_qty>0 and b.expiry_date<=(clock_timestamp() at time zone 'Asia/Kolkata')::date+7) expiring_batches,
      (select count(*) from public.cash_shifts c where c.location_id=l.id and c.closed_at>=clock_timestamp()-interval '7 days' and c.difference<>0) cash_variances
      from public.locations l where l.id=any(v_stores) and (p_location is null or l.id=p_location) order by l.name,l.id) x),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(x) from(select id,event_type,entity_type,created_at,location_id from public.events where org_id=v_org and location_id=any(v_stores) and (p_location is null or location_id=p_location) order by created_at desc,id desc limit 50) x),'[]'::jsonb));
end $$;
revoke all on function public.manager_dashboard(uuid) from public,anon;
grant execute on function public.manager_dashboard(uuid) to authenticated;
