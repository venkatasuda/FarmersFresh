-- Transfers leave source stock at dispatch and enter destination stock once,
-- after receipt. Batch metadata travels with the goods, including expiry.
alter policy batches_staff on public.product_batches using (org_id=public.current_org_id() and
  (public.is_org_owner() or public.has_location_permission(location_id,'inventory.adjust')));
alter policy wastage_read on public.wastage_log using (org_id=public.current_org_id() and
  public.has_location_permission(location_id,'inventory.adjust'));
create table public.stock_transfers (
  id uuid primary key,
  org_id uuid not null references public.organizations(id),
  source_id uuid not null references public.locations(id),
  destination_id uuid not null references public.locations(id),
  product_id uuid not null references public.products(id),
  quantity numeric(12,3) not null check(quantity>0 and quantity<=100000),
  status text not null default 'dispatched' check(status in ('dispatched','received')),
  batches jsonb not null default '[]',
  note text not null check(length(note)<=500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  received_by uuid references auth.users(id),
  received_at timestamptz,
  check(source_id<>destination_id)
);
create index stock_transfers_source on public.stock_transfers(source_id,created_at desc);
create index stock_transfers_destination on public.stock_transfers(destination_id,created_at desc);
alter table public.stock_transfers enable row level security;
revoke all on public.stock_transfers from anon,authenticated;
grant select on public.stock_transfers to authenticated;
create policy transfer_read on public.stock_transfers for select to authenticated using (
  org_id=public.current_org_id() and (
    public.has_location_permission(source_id,'inventory.adjust') or
    public.has_location_permission(destination_id,'inventory.adjust')));

alter table public.product_batches add column origin_batch_id uuid references public.product_batches(id);
alter table public.product_batches drop constraint product_batches_source_check;
alter table public.product_batches add constraint product_batches_source_check check(source in
  ('purchase','production','opening','adjustment','return','traceability','transfer'));

create function public.stock_transfer_locations(p_source uuid)
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
  select l.id,l.name from public.locations l where l.org_id=public.current_org_id()
    and l.type='store' and l.id<>p_source
    and public.has_location_permission(p_source,'inventory.adjust') order by l.name,l.id;
$$;

create function public.dispatch_stock_transfer(p_id uuid,p_source uuid,p_destination uuid,p_product uuid,p_quantity numeric,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid:=public.current_org_id(); v_unit text; v_need numeric; v_take numeric;
  b record; t public.stock_transfers%rowtype; v_batches jsonb:='[]';
begin
  if auth.uid() is null or not public.has_location_permission(p_source,'inventory.adjust') then
    raise exception 'You do not have access to that location.' using errcode='42501'; end if;
  if p_id is null or p_destination is null or p_destination=p_source or not exists(
    select 1 from public.locations where id=p_destination and org_id=v_org and type='store') then
    raise exception 'Choose another store in your organization.'; end if;
  if p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity') or p_quantity<=0
    or p_quantity>100000 or p_quantity<>round(p_quantity,3) then raise exception 'Enter a valid stock quantity.'; end if;
  if p_note is null or length(p_note)>500 then raise exception 'Keep the note within 500 characters.'; end if;
  -- Same product-first lock order as the existing receiving/adjustment RPCs.
  select unit into v_unit from public.products where id=p_product and org_id=v_org for update;
  if not found then raise exception 'Product not found.'; end if;
  if v_unit='piece' and p_quantity<>trunc(p_quantity) then raise exception 'Enter a whole number of pieces.'; end if;
  select * into t from public.stock_transfers where id=p_id;
  if found then
    if t.org_id<>v_org or t.source_id<>p_source or t.destination_id<>p_destination
      or t.product_id<>p_product or t.quantity<>p_quantity or t.note<>p_note or t.created_by<>auth.uid() then
      raise exception 'This request was already used for a different change.'; end if;
    return t.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock:'||p_source::text||':'||p_product::text,0));
  if public.stock_available(p_source,p_product)<p_quantity then raise exception 'Insufficient stock.'; end if;
  insert into public.stock_transfers(id,org_id,source_id,destination_id,product_id,quantity,note,created_by)
    values(p_id,v_org,p_source,p_destination,p_product,p_quantity,p_note,auth.uid());
  v_need:=p_quantity;
  for b in select * from public.product_batches where org_id=v_org and location_id=p_source
    and product_id=p_product and status='active' and remaining_qty>0
    and (expiry_date is null or expiry_date>=(now() at time zone 'Asia/Kolkata')::date)
    order by expiry_date nulls last,created_at,id for update
  loop
    exit when v_need=0;
    v_take:=least(b.remaining_qty,v_need);
    v_batches:=v_batches||jsonb_build_array(jsonb_build_object('id',b.id,'quantity',v_take,
      'batch_code',b.batch_code,'expiry_date',b.expiry_date,'source_date',b.source_date,
      'unit_cost',b.unit_cost,'farm_id',b.farm_id,'supplier_id',b.supplier_id));
    insert into public.stock_movements(org_id,location_id,product_id,delta,reason,ref_type,ref_id,actor_id,note,batch_id)
      values(v_org,p_source,p_product,-v_take,'transfer_out','stock_transfer',p_id,auth.uid(),p_note,b.id);
    v_need:=v_need-v_take;
  end loop;
  if v_need<>0 then raise exception 'Not enough unexpired batch stock to transfer.'; end if;
  update public.stock_transfers set batches=v_batches where id=p_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(v_org,p_source,auth.uid(),'stock.transfer_dispatched','stock_transfer',p_id,
      jsonb_build_object('destination_id',p_destination,'product_id',p_product,'quantity',p_quantity));
  return p_id;
end $$;

create function public.receive_stock_transfer(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare t public.stock_transfers%rowtype; b record; v_batch uuid; v_expired boolean; v_waste numeric:=0; v_name text;
begin
  select * into t from public.stock_transfers where id=p_id and org_id=public.current_org_id();
  if auth.uid() is null or t.id is null or not public.has_location_permission(t.destination_id,'inventory.adjust') then
    raise exception 'You do not have access to that location.' using errcode='42501'; end if;
  select name into v_name from public.products where id=t.product_id for update;
  select * into t from public.stock_transfers where id=p_id for update;
  if t.status='received' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('stock:'||t.destination_id::text||':'||t.product_id::text,0));
  for b in select * from jsonb_to_recordset(t.batches) as x(id uuid,quantity numeric,batch_code text,
    expiry_date date,source_date date,unit_cost numeric,farm_id uuid,supplier_id uuid)
  loop
    v_expired:=b.expiry_date<(now() at time zone 'Asia/Kolkata')::date;
    insert into public.product_batches(org_id,location_id,product_id,origin_batch_id,batch_code,source,
      received_qty,remaining_qty,quantity,unit_cost,source_date,expiry_date,farm_id,supplier_id,status,created_by)
    values(t.org_id,t.destination_id,t.product_id,b.id,b.batch_code,'transfer',b.quantity,0,b.quantity,
      b.unit_cost,b.source_date,b.expiry_date,b.farm_id,b.supplier_id,'active',auth.uid()) returning id into v_batch;
    insert into public.stock_movements(org_id,location_id,product_id,delta,reason,ref_type,ref_id,actor_id,note,batch_id)
      values(t.org_id,t.destination_id,t.product_id,b.quantity,'transfer_in','stock_transfer',t.id,auth.uid(),t.note,v_batch);
    -- Goods that expired in transit never become available for sale.
    if v_expired then
      insert into public.stock_movements(org_id,location_id,product_id,delta,reason,ref_type,ref_id,actor_id,note,batch_id)
        values(t.org_id,t.destination_id,t.product_id,-b.quantity,'waste','stock_transfer',t.id,auth.uid(),'Expired in transit',v_batch);
      insert into public.wastage_log(org_id,location_id,product_id,product_name,quantity,reason,unit_cost,note,actor_id)
        values(t.org_id,t.destination_id,t.product_id,v_name,b.quantity,'expiry',b.unit_cost,'Expired in transit',auth.uid());
      v_waste:=v_waste+b.quantity;
    end if;
  end loop;
  update public.stock_transfers set status='received',received_at=now(),received_by=auth.uid() where id=t.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(t.org_id,t.destination_id,auth.uid(),'stock.transfer_received','stock_transfer',t.id,
      jsonb_build_object('source_id',t.source_id,'product_id',t.product_id,'quantity',t.quantity,'expired_quantity',v_waste));
end $$;

create unique index stock_count_request on public.events(org_id,entity_id) where event_type='stock.counted';
create function public.count_stock(p_id uuid,p_location uuid,p_product uuid,p_count numeric,p_expected numeric,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid:=public.current_org_id(); v_quantity numeric; v_unit text; v_payload jsonb; e public.events%rowtype;
begin
  if auth.uid() is null or not public.has_location_permission(p_location,'inventory.adjust') then
    raise exception 'You do not have access to that location.' using errcode='42501'; end if;
  if p_id is null or p_count is null or p_expected is null
    or p_count::text in ('NaN','Infinity','-Infinity') or p_expected::text in ('NaN','Infinity','-Infinity')
    or p_count<0 or p_count>100000 or p_expected<0 or p_count<>round(p_count,3) then
    raise exception 'Enter a valid stock quantity.'; end if;
  if nullif(trim(p_note),'') is null or length(p_note)>500 then raise exception 'Give a count reason within 500 characters.'; end if;
  select unit into v_unit from public.products where id=p_product and org_id=v_org for update;
  if not found then raise exception 'Product not found.'; end if;
  if v_unit='piece' and p_count<>trunc(p_count) then raise exception 'Enter a whole number of pieces.'; end if;
  v_payload:=jsonb_build_object('product_id',p_product,'count',p_count,'expected',p_expected,'note',p_note);
  select * into e from public.events where org_id=v_org and entity_id=p_id and event_type='stock.counted';
  if found then
    if e.location_id<>p_location or e.actor_id<>auth.uid() or e.payload<>v_payload then
      raise exception 'This request was already used for a different change.'; end if;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock:'||p_location::text||':'||p_product::text,0));
  v_quantity:=public.stock_available(p_location,p_product);
  if v_quantity<>p_expected then raise exception 'Stock changed. Refresh and count again.'; end if;
  if p_count<>v_quantity then
    insert into public.stock_movements(org_id,location_id,product_id,delta,reason,ref_type,ref_id,actor_id,note)
      values(v_org,p_location,p_product,p_count-v_quantity,'stock_count','stock_count',p_id,auth.uid(),p_note);
  end if;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(v_org,p_location,auth.uid(),'stock.counted','stock_count',p_id,v_payload);
end $$;

-- Retain the existing manual-adjustment implementation, but close the old
-- one-sided transfer and count paths for every API client.
alter function public.record_stock(uuid,uuid,numeric,text,text) rename to record_stock_adjustment;
revoke all on function public.record_stock_adjustment(uuid,uuid,numeric,text,text) from public,anon,authenticated,service_role;
create function public.record_stock(p_location uuid,p_product uuid,p_delta numeric,p_reason text,p_note text default null)
returns bigint language plpgsql security definer set search_path='' as $$
begin
  perform public.require_permission('inventory.adjust');
  if p_reason in ('transfer_in','transfer_out','stock_count') then raise exception 'Use the stock count or transfer workflow.'; end if;
  if p_reason='waste' then
    if p_delta is null or p_delta>=0 or p_delta< -1000 then raise exception 'Enter a valid stock quantity.'; end if;
    perform public.log_wastage(p_location,p_product,-p_delta,'other',p_note);
    return currval(pg_get_serial_sequence('public.stock_movements','id'));
  end if;
  return public.record_stock_adjustment(p_location,p_product,p_delta,p_reason,p_note);
end $$;

revoke all on function public.stock_transfer_locations(uuid),public.dispatch_stock_transfer(uuid,uuid,uuid,uuid,numeric,text),
  public.receive_stock_transfer(uuid),public.count_stock(uuid,uuid,uuid,numeric,numeric,text),public.record_stock(uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.stock_transfer_locations(uuid),public.dispatch_stock_transfer(uuid,uuid,uuid,uuid,numeric,text),
  public.receive_stock_transfer(uuid),public.count_stock(uuid,uuid,uuid,numeric,numeric,text),public.record_stock(uuid,uuid,numeric,text,text) to authenticated;

DROP FUNCTION public.expiring_batches(integer);
CREATE FUNCTION public.expiring_batches(p_days integer DEFAULT 7, p_location uuid DEFAULT NULL) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'product_id', b.product_id, 'product_name', p.name, 'batch_code', b.batch_code,
    'remaining', round(b.remaining_qty,3), 'expiry_date', b.expiry_date,
    'days_left', (b.expiry_date - (now() at time zone 'Asia/Kolkata')::date),
    'value', round(b.remaining_qty * b.unit_cost, 2),
    'sale_price', p.sale_price, 'last_cost', p.last_cost,
    'marked_down', exists(select 1 from public.markdowns m where m.product_id = b.product_id and m.active)
  ) order by b.expiry_date asc), '[]'::jsonb)
  from public.product_batches b
  join public.products p on p.id = b.product_id
  where b.org_id = public.current_org_id()
    and (p_location is null or b.location_id=p_location) and public.has_location_permission(b.location_id,'inventory.adjust')
    and b.status in ('active','expired') and b.remaining_qty > 0
    and b.expiry_date is not null
    and b.expiry_date <= (now() at time zone 'Asia/Kolkata')::date + least(greatest(coalesce(p_days,7),0),365);
$$;
REVOKE ALL ON FUNCTION public.expiring_batches(integer, uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.expiring_batches(integer, uuid) TO authenticated;

DROP FUNCTION public.list_wastage(integer, integer);
CREATE FUNCTION public.list_wastage(p_days integer DEFAULT 30, p_limit integer DEFAULT 100, p_location uuid DEFAULT NULL) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'product_name', w.product_name, 'quantity', w.quantity,
    'reason', w.reason, 'value', round(w.quantity * w.unit_cost, 2),
    'note', w.note, 'created_at', w.created_at
  ) order by w.created_at desc), '[]'::jsonb)
  from (select * from public.wastage_log where org_id=public.current_org_id()
      and (p_location is null or location_id=p_location) and public.has_location_permission(location_id,'inventory.adjust')
      and created_at>=now()-make_interval(days=>least(greatest(coalesce(p_days,30),1),365))
      order by created_at desc limit least(greatest(coalesce(p_limit,100),1),500)) w
  ;
$$;
REVOKE ALL ON FUNCTION public.list_wastage(integer, integer, uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_wastage(integer, integer, uuid) TO authenticated;

DROP FUNCTION public.wastage_summary(integer);
CREATE FUNCTION public.wastage_summary(p_days integer DEFAULT 30, p_location uuid DEFAULT NULL) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with w as (
    select * from public.wastage_log
    where org_id = public.current_org_id()
      and (p_location is null or location_id=p_location) and public.has_location_permission(location_id,'inventory.adjust')
      and created_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1),365))
  )
  select jsonb_build_object(
    'total_value', (select coalesce(round(sum(quantity * unit_cost),2),0) from w),
    'total_events', (select count(*) from w),
    'by_reason', (select coalesce(jsonb_agg(jsonb_build_object(
        'reason', reason, 'value', value, 'events', events) order by value desc), '[]'::jsonb)
      from (select reason, round(sum(quantity*unit_cost),2) as value, count(*) as events
            from w group by reason) r),
    'by_product', (select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', product_name, 'quantity', qty, 'value', value) order by value desc), '[]'::jsonb)
      from (select product_name, sum(quantity) as qty, round(sum(quantity*unit_cost),2) as value
            from w group by product_name order by value desc limit 10) p)
  );
$$;
REVOKE ALL ON FUNCTION public.wastage_summary(integer, uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wastage_summary(integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.write_off_batch(p_batch uuid, p_reason text DEFAULT 'expiry'::text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; b record;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if p_reason is null or p_reason not in ('spoilage','expiry','damage','theft','count_adjustment','other') then
    raise exception 'Pick a valid reason.';
  end if;
  select * into b from public.product_batches where id = p_batch and org_id = v_org;
  if b.id is null then raise exception 'Batch not found.'; end if;
  if not public.has_location_permission(b.location_id,'inventory.adjust') then raise exception 'Access denied.' using errcode='42501'; end if;
  perform 1 from public.products where id=b.product_id for update;
  perform pg_advisory_xact_lock(hashtextextended('stock:'||b.location_id::text||':'||b.product_id::text,0));
  select * into b from public.product_batches where id=p_batch for update;
  if b.remaining_qty<=0 then return; end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note, batch_id)
  values (v_org, b.location_id, b.product_id, -b.remaining_qty, 'waste', 'wastage', p_batch, auth.uid(),
          p_reason || ' - batch ' || b.batch_code || coalesce(' - ' || nullif(trim(coalesce(p_note,'')),''), ''),
          p_batch);

  insert into public.wastage_log
    (org_id, location_id, product_id, product_name, quantity, reason, unit_cost, note, actor_id)
  select v_org, b.location_id, b.product_id, p.name, b.remaining_qty, p_reason, b.unit_cost,
         'Batch ' || b.batch_code || coalesce(' - ' || nullif(trim(coalesce(p_note,'')),''), ''), auth.uid()
  from public.products p where p.id = b.product_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,b.location_id,auth.uid(),'batch.written_off','batch',p_batch);
end $$;
