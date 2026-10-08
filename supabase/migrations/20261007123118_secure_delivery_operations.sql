alter table public.orders add column delivery_failure_note text check(length(delivery_failure_note) between 1 and 500);
alter table public.orders add column delivery_failed_at timestamptz;

create or replace function public.my_shift()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.memberships m join public.role_capabilities c on c.role=m.role
    where m.user_id=auth.uid() and m.org_id=public.current_org_id() and m.on_shift and c.capability='delivery.assign');
$$;

create or replace function public.claim_delivery(p_order_id uuid,p_take boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; v_org uuid:=public.current_org_id();
begin
  if auth.uid() is null then raise exception 'Access denied.' using errcode='42501'; end if;
  -- ponytail: one assignment lock per organization; split by store if measured
  -- assignment throughput requires it. Claim and auto-assignment share it.
  perform pg_advisory_xact_lock(hashtextextended('delivery-assignment:'||v_org::text,0));
  select * into o from public.orders where id=p_order_id and org_id=v_org for update;
  if o.id is null or not public.has_location_permission(o.location_id,'delivery.assign') then
    raise exception 'Access denied.' using errcode='42501'; end if;
  if p_take is null or o.status not in ('confirmed','packed') then
    raise exception 'Only confirmed or packed deliveries can be claimed or released.'; end if;
  if o.assigned_to is not null and o.assigned_to<>auth.uid() then
    raise exception 'This delivery is assigned to another rider.'; end if;
  if (p_take and o.assigned_to=auth.uid()) or (not p_take and o.assigned_to is null) then return; end if;
  update public.orders set assigned_to=case when p_take then auth.uid() else null end,
    assigned_at=case when p_take then now() else null end,
    rider_lat=null,rider_lng=null,rider_location_at=null,eta_minutes=null,eta_set_at=null where id=o.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
    values(o.org_id,o.location_id,auth.uid(),case when p_take then 'delivery.claimed' else 'delivery.released' end,'order',o.id);
end $$;

create or replace function public.set_my_shift(p_on boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_org uuid:=public.current_org_id(); v_membership record;
begin
  if auth.uid() is null or not public.has_permission('delivery.assign') then
    raise exception 'Access denied.' using errcode='42501'; end if;
  if p_on is null then raise exception 'Choose a shift status.'; end if;
  for v_membership in update public.memberships m set on_shift=p_on
    where m.org_id=v_org and m.user_id=auth.uid() and m.on_shift is distinct from p_on
      and exists(select 1 from public.role_capabilities c where c.role=m.role and c.capability='delivery.assign')
    returning m.location_id
  loop
    insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
      values(v_org,v_membership.location_id,auth.uid(),'delivery.shift_changed','profile',auth.uid(),jsonb_build_object('on_shift',p_on));
  end loop;
  if not exists(select 1 from public.memberships m join public.role_capabilities c on c.role=m.role
    where m.org_id=v_org and m.user_id=auth.uid() and c.capability='delivery.assign') then
    raise exception 'A delivery staff membership is required to go on shift.'; end if;
  return p_on;
end $$;

create or replace function public.update_rider_location(p_order_id uuid,p_lat double precision,p_lng double precision,p_eta integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if auth.uid() is null or o.id is null or o.assigned_to is distinct from auth.uid()
    or not public.has_location_permission(o.location_id,'delivery.assign') then
    raise exception 'Access denied.' using errcode='42501'; end if;
  if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180)
    or (p_eta is not null and (p_eta<0 or p_eta>1440)) then raise exception 'Invalid location or ETA.'; end if;
  if o.status<>'out_for_delivery' or o.delivery_failed_at is not null then
    raise exception 'This delivery is not currently on the way.'; end if;
  update public.orders set rider_lat=p_lat,rider_lng=p_lng,rider_location_at=now(),
    eta_minutes=coalesce(p_eta,eta_minutes),eta_set_at=case when p_eta is null then eta_set_at else now() end where id=o.id;
end $$;

create or replace function public.auto_assign_deliveries()
returns integer language plpgsql security definer set search_path='' as $$
declare v_org uuid; o record; v_rider uuid; v_n integer:=0; v_system boolean;
begin
  v_system:=auth.uid() is null and (
    current_setting('role',true)='service_role' or
    (session_user in ('postgres','supabase_admin') and current_setting('role',true) in ('none','postgres','supabase_admin')));
  if not v_system and (auth.uid() is null or not public.has_permission('delivery.assign')) then
    raise exception 'Access denied.' using errcode='42501'; end if;
  for v_org in select id from public.organizations where v_system or id=public.current_org_id() order by id
  loop
    perform pg_advisory_xact_lock(hashtextextended('delivery-assignment:'||v_org::text,0));
    for o in select * from public.orders where org_id=v_org and assigned_to is null
      and status in ('confirmed','packed')
      and (v_system or public.has_location_permission(location_id,'delivery.assign'))
      order by placed_at,id for update
    loop
      select m.user_id into v_rider from public.memberships m
      join public.role_capabilities c on c.role=m.role and c.capability='delivery.assign'
      where m.org_id=v_org and m.on_shift and m.location_id=o.location_id
      group by m.user_id
      order by (select count(*) from public.orders a where a.org_id=v_org and a.assigned_to=m.user_id
        and a.status in ('confirmed','packed','out_for_delivery')),m.user_id limit 1;
      if v_rider is null then continue; end if;
      update public.orders set assigned_to=v_rider,assigned_at=now() where id=o.id;
      insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
        values(v_org,o.location_id,auth.uid(),'order.auto_assigned','order',o.id,jsonb_build_object('assigned_to',v_rider));
      v_n:=v_n+1;
    end loop;
  end loop;
  return v_n;
end $$;

-- A failed attempt keeps its stock reservation and payment unchanged. Only
-- explicit physical return to the store makes it available for another rider.
create function public.report_delivery_failure(p_order_id uuid,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if auth.uid() is null or o.id is null or o.assigned_to is distinct from auth.uid()
    or not public.has_location_permission(o.location_id,'delivery.assign') then
    raise exception 'Access denied.' using errcode='42501'; end if;
  if nullif(trim(p_note),'') is null or length(p_note)>500 then raise exception 'Give a delivery failure reason within 500 characters.'; end if;
  if o.status<>'out_for_delivery' then raise exception 'This delivery is not currently on the way.'; end if;
  if o.delivery_failed_at is not null then return; end if;
  update public.orders set delivery_failed_at=now(),delivery_failure_note=trim(p_note),
    rider_lat=null,rider_lng=null,rider_location_at=null,eta_minutes=null,eta_set_at=null where id=o.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(o.org_id,o.location_id,auth.uid(),'delivery.failed','order',o.id,jsonb_build_object('reason',trim(p_note)));
end $$;

create function public.receive_failed_delivery(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if auth.uid() is null or o.id is null or not public.has_location_permission(o.location_id,'orders.manage') then
    raise exception 'Access denied.' using errcode='42501'; end if;
  if o.status='packed' and o.delivery_failed_at is null and exists(select 1 from public.events
    where entity_id=o.id and event_type='delivery.returned') then return; end if;
  if o.status<>'out_for_delivery' or o.delivery_failed_at is null then raise exception 'Report the failed delivery first.'; end if;
  update public.orders set status='packed',assigned_to=null,assigned_at=null,
    delivery_failed_at=null,delivery_failure_note=null,rider_lat=null,rider_lng=null,rider_location_at=null,
    eta_minutes=null,eta_set_at=null where id=o.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(o.org_id,o.location_id,auth.uid(),'delivery.returned','order',o.id,
      jsonb_build_object('previous_rider',o.assigned_to,'reason',o.delivery_failure_note));
end $$;

revoke all on function public.report_delivery_failure(uuid,text),public.receive_failed_delivery(uuid) from public,anon;
grant execute on function public.report_delivery_failure(uuid,text),public.receive_failed_delivery(uuid) to authenticated;

-- Every client follows the same store-scoped, sequential fulfilment rules.
create or replace function public.set_order_status(p_order_id uuid, p_to text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_o public.orders%rowtype;
  v_chain constant text[] := array['placed','confirmed','packed','out_for_delivery','delivered'];
  v_from int; v_new int;
begin
  select * into v_o from public.orders where id=p_order_id for update;
  if auth.uid() is null or v_o.id is null or not (
    public.has_location_permission(v_o.location_id,'orders.manage')
    or (p_to in ('out_for_delivery','delivered') and v_o.assigned_to=auth.uid()
        and public.has_location_permission(v_o.location_id,'delivery.assign'))
  ) then
    raise exception 'Order not found.' using errcode='42501';
  end if;
  if v_o.delivery_failed_at is not null then
    raise exception 'Return the failed delivery to the store before retrying.';
  end if;
  v_from := array_position(v_chain,v_o.status);
  v_new := array_position(v_chain,p_to);
  if v_from is null or v_new is null then
    raise exception 'This order is % and can''t be moved to %.',
      replace(v_o.status,'_',' '), replace(coalesce(p_to,'that status'),'_',' ');
  end if;
  -- Retries must not duplicate audit events, rewards or notifications.
  if v_new=v_from then return; end if;
  if v_new<>v_from+1 then
    raise exception 'This order is % and can''t be moved to %.',
      replace(v_o.status,'_',' '), replace(p_to,'_',' ');
  end if;
  update public.orders set status=p_to,
    confirmed_at=case when p_to='confirmed' then coalesce(confirmed_at,now()) else confirmed_at end,
    delivered_at=case when p_to='delivered' then now() else delivered_at end
    where id=p_order_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
  values(v_o.org_id,v_o.location_id,auth.uid(),'order.status_changed','order',p_order_id,
    jsonb_build_object('from',v_o.status,'to',p_to));
end $$;
revoke all on function public.set_order_status(uuid,text) from public,anon;
grant execute on function public.set_order_status(uuid,text) to authenticated;

CREATE OR REPLACE FUNCTION public.track_order(p_number text, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_order record; v_phone text; v_items jsonb; v_track jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');
  if coalesce(trim(p_number), '') = '' or v_phone !~ '^[6-9][0-9]{9}$' then
    return null;
  end if;

  select o.id, o.order_number, o.status, o.total, o.subtotal, o.delivery_fee,
         o.placed_at, o.confirmed_at, o.delivered_at, o.delivery_slot,
         o.contact_name, o.cancelled_reason, o.delivery_failed_at,
         o.rider_lat, o.rider_lng, o.rider_location_at, o.eta_minutes, o.eta_set_at
    into v_order
  from public.orders o
  where upper(o.order_number) = upper(trim(p_number))
    and o.contact_phone = v_phone;

  if v_order.id is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'name', oi.product_name, 'quantity', oi.quantity,
           'unit', oi.unit, 'line_total', oi.line_total, 'slug', p.slug
         ) order by oi.product_name)
    into v_items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id;

  -- Live tracking payload only while the order is actually on the way.
  if v_order.status = 'out_for_delivery' and v_order.delivery_failed_at is null and v_order.rider_lat is not null then
    v_track := jsonb_build_object(
      'lat', v_order.rider_lat, 'lng', v_order.rider_lng,
      'updated_at', v_order.rider_location_at,
      'eta_minutes', v_order.eta_minutes, 'eta_set_at', v_order.eta_set_at);
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number, 'status', v_order.status,
    'total', v_order.total, 'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee, 'placed_at', v_order.placed_at,
    'confirmed_at', v_order.confirmed_at, 'delivered_at', v_order.delivered_at,
    'delivery_slot', v_order.delivery_slot, 'contact_name', v_order.contact_name,
    'cancelled_reason', v_order.cancelled_reason,
    'delivery_failed', v_order.delivery_failed_at is not null,
    'items', coalesce(v_items, '[]'::jsonb),
    'tracking', v_track
  );
end $_$;
