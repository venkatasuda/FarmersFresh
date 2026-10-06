-- A capability must belong to the membership at the requested location.
create or replace function public.has_location_permission(p_location uuid, p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.locations l where l.id=p_location and l.org_id=public.current_org_id()
    and (public.is_org_owner() or exists(select 1 from public.memberships m
      join public.role_capabilities rc on rc.role=m.role and rc.capability=p_capability
      where m.org_id=l.org_id and m.location_id=l.id and m.user_id=auth.uid())));
$$;
revoke all on function public.has_location_permission(uuid,text) from public,anon;
grant execute on function public.has_location_permission(uuid,text) to authenticated,service_role;

create or replace function public.operational_locations(p_capability text)
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
  select l.id,l.name from public.locations l where l.type='store'
    and p_capability in ('inventory.adjust','procurement.manage')
    and public.has_location_permission(l.id,p_capability) order by l.name,l.id;
$$;
revoke all on function public.operational_locations(text) from public,anon;
grant execute on function public.operational_locations(text) to authenticated,service_role;

alter policy po_read on public.purchase_orders using (org_id=public.current_org_id() and public.has_location_permission(location_id,'procurement.manage'));
alter policy poi_read on public.purchase_order_items using (org_id=public.current_org_id() and exists(select 1 from public.purchase_orders po where po.id=po_id and public.has_location_permission(po.location_id,'procurement.manage')));
-- All ledger writes go through the validated, audited RPC.
revoke insert,update,delete on public.stock_movements from anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_stock(p_location uuid, p_product uuid, p_delta numeric, p_reason text, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_id bigint; v_on_hand numeric;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location_permission(p_location,'inventory.adjust') then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  perform 1 from public.products where id=p_product and org_id=v_org for update;
  if not found then raise exception 'Product not found.'; end if;
  if p_delta is null or p_delta::text in ('NaN','Infinity','-Infinity') or abs(p_delta)>1000 then raise exception 'Invalid amount.'; end if;
  if length(p_note)>2000 then raise exception 'Note is too long.'; end if;
  if p_reason is null or p_reason not in ('production','purchase','waste','adjustment','stock_count',
                      'transfer_in','transfer_out') then
    raise exception 'Invalid reason for a manual movement.';
  end if;
  if p_delta = 0 then raise exception 'Movement cannot be zero.'; end if;

  -- Stock cannot go negative by hand. If it wants to, the count is wrong and
  -- someone should look, rather than the number quietly going below zero.
  v_on_hand := public.stock_available(p_location, p_product);
  if v_on_hand + p_delta < 0 then
    raise exception 'That would take stock below zero (on hand: % kg).', v_on_hand;
  end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, actor_id, note)
  values (v_org, p_location, p_product, p_delta, p_reason, auth.uid(), p_note)
  returning id into v_id;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, p_location, auth.uid(), 'stock.' || p_reason, 'product', p_product,
          jsonb_build_object('delta', p_delta, 'note', p_note));

  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.create_purchase_order(p_location uuid, p_supplier uuid, p_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_id uuid; v_number text;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location_permission(p_location,'procurement.manage') then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if p_supplier is not null and not exists(select 1 from public.suppliers where id=p_supplier and org_id=v_org) then raise exception 'Supplier not found.'; end if;
  if length(p_notes)>2000 then raise exception 'Notes are too long.'; end if;
  v_number := 'PO-' || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
              || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
  insert into public.purchase_orders (org_id, location_id, supplier_id, po_number, notes, created_by)
  values (v_org, p_location, p_supplier, v_number, nullif(trim(coalesce(p_notes,'')),''), auth.uid())
  returning id into v_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,p_location,auth.uid(),'purchase_order.header_created','purchase_order',v_id);
  return jsonb_build_object('id', v_id, 'po_number', v_number);
end $$;

CREATE OR REPLACE FUNCTION public.add_po_item(p_po uuid, p_product uuid, p_qty numeric, p_unit_cost numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_status text; v_name text; v_id uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org for update;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if not exists(select 1 from public.purchase_orders po where po.id=p_po and public.has_location_permission(po.location_id,'procurement.manage')) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if v_status <> 'draft' then raise exception 'You can only add items while the order is a draft.'; end if;
  if p_qty is null or p_qty::text in ('NaN','Infinity','-Infinity') or p_qty <= 0 or p_qty > 100000 then raise exception 'Invalid quantity.'; end if;
  if p_unit_cost is null or p_unit_cost::text in ('NaN','Infinity','-Infinity') or p_unit_cost < 0 or p_unit_cost > 10000000 then raise exception 'Invalid cost.'; end if;
  select name into v_name from public.products where id = p_product and org_id = v_org;
  if v_name is null then raise exception 'Product not found.'; end if;
  insert into public.purchase_order_items (po_id, org_id, product_id, product_name, qty_ordered, unit_cost)
  values (p_po, v_org, p_product, v_name, p_qty, greatest(coalesce(p_unit_cost,0),0))
  returning id into v_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  select v_org,po.location_id,auth.uid(),'purchase_order.item_added','purchase_order',p_po from public.purchase_orders po where po.id=p_po;
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.mark_po_ordered(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_status text; v_n int;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org for update;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if not exists(select 1 from public.purchase_orders po where po.id=p_po and public.has_location_permission(po.location_id,'procurement.manage')) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if v_status <> 'draft' then raise exception 'Only a draft can be marked as ordered.'; end if;
  select count(*) into v_n from public.purchase_order_items where po_id = p_po;
  if v_n = 0 then raise exception 'Add at least one item before ordering.'; end if;
  update public.purchase_orders set status = 'ordered', ordered_at = now(), updated_at = now()
   where id = p_po and org_id = v_org;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  select v_org,po.location_id,auth.uid(),'purchase_order.ordered','purchase_order',p_po from public.purchase_orders po where po.id=p_po;
end $$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_status text;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status into v_status from public.purchase_orders where id = p_po and org_id = v_org for update;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if not exists(select 1 from public.purchase_orders po where po.id=p_po and public.has_location_permission(po.location_id,'procurement.manage')) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if v_status = 'received' then raise exception 'A received order cannot be cancelled.'; end if;
  update public.purchase_orders set status = 'cancelled', updated_at = now()
   where id = p_po and org_id = v_org;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  select v_org,po.location_id,auth.uid(),'purchase_order.cancelled','purchase_order',p_po from public.purchase_orders po where po.id=p_po;
end $$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po uuid, p_items jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_org uuid; v_loc uuid; v_status text; v_supplier uuid; v_number text;
  el jsonb; v_item record; v_qty numeric; v_expiry date; v_batch uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select status, location_id, supplier_id, po_number
    into v_status, v_loc, v_supplier, v_number
    from public.purchase_orders where id = p_po and org_id = v_org for update;
  if v_status is null then raise exception 'Purchase order not found.'; end if;
  if not public.has_location_permission(v_loc,'procurement.manage') then raise exception 'Access denied.' using errcode='42501'; end if;
  if v_status not in ('draft','ordered') then
    raise exception 'This order has already been received or cancelled.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid receipt items.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Add received items.'; end if;
  if (select count(*) <> count(distinct receipt.value->>'item_id') from jsonb_array_elements(p_items) receipt(value)) then raise exception 'Duplicate receipt items.'; end if;

  for el in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_qty := coalesce((el->>'qty')::numeric, 0);
    if v_qty::text in ('NaN','Infinity','-Infinity') or v_qty <= 0 then raise exception 'Invalid received quantity.'; end if;
    select * into v_item from public.purchase_order_items
     where id = (el->>'item_id')::uuid and po_id = p_po and org_id = v_org;
    if v_item.id is null then raise exception 'Receipt item not found.'; end if;
    if v_qty > v_item.qty_ordered then raise exception 'Received quantity exceeds the order.'; end if;

    v_expiry := null;
    if coalesce(el->>'expiry','') <> '' then
      v_expiry := (el->>'expiry')::date;
    end if;

    -- One lot per received line. remaining starts 0; the stamped movement's
    -- trigger raises it to v_qty (single source of truth for remaining).
    insert into public.product_batches (
      org_id, location_id, product_id, batch_code, source, po_id, supplier_id,
      received_qty, remaining_qty, quantity, unit_cost, source_date, expiry_date, status, created_by
    ) values (
      v_org, v_loc, v_item.product_id,
      'B-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
        lpad(nextval('public.batch_code_seq')::text, 4, '0'),
      'purchase', p_po, v_supplier,
      v_qty, 0, v_qty, v_item.unit_cost,
      (now() at time zone 'Asia/Kolkata')::date, v_expiry, 'active', auth.uid()
    ) returning id into v_batch;

    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note, batch_id)
    values (v_org, v_loc, v_item.product_id, v_qty, 'purchase', 'purchase_order', p_po, auth.uid(),
            'Received on ' || v_number, v_batch);

    update public.purchase_order_items set qty_received = v_qty where id = v_item.id;
    update public.products set last_cost = v_item.unit_cost, updated_at = now()
      where id = v_item.product_id and org_id = v_org;
  end loop;

  update public.purchase_orders set status = 'received', received_at = now(), updated_at = now()
    where id = p_po and org_id = v_org;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, auth.uid(), 'purchase.received', 'purchase_order', p_po,
          jsonb_build_object('po', p_po));
end $$;

CREATE OR REPLACE FUNCTION public.get_purchase_order(p_po uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when po.id is null then null else jsonb_build_object(
    'id', po.id, 'po_number', po.po_number, 'status', po.status,
    'supplier_id', po.supplier_id, 'supplier', s.name, 'notes', po.notes,
    'location_id', po.location_id,
    'ordered_at', po.ordered_at, 'received_at', po.received_at, 'created_at', po.created_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'product_name', i.product_name,
        'qty_ordered', i.qty_ordered, 'unit_cost', i.unit_cost, 'qty_received', i.qty_received
      ) order by i.created_at), '[]'::jsonb)
      from public.purchase_order_items i where i.po_id = po.id)
  ) end
  from public.purchase_orders po
  left join public.suppliers s on s.id = po.supplier_id
  where po.id = p_po and po.org_id = public.current_org_id() and public.has_location_permission(po.location_id,'procurement.manage');
$$;

drop function if exists public.list_purchase_orders(text,integer);
CREATE OR REPLACE FUNCTION public.list_purchase_orders(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_location uuid default null) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', po.id, 'location_id', po.location_id, 'po_number', po.po_number, 'status', po.status,
      'supplier', s.name, 'notes', po.notes,
      'ordered_at', po.ordered_at, 'received_at', po.received_at, 'created_at', po.created_at,
      'item_count', (select count(*) from public.purchase_order_items i where i.po_id = po.id),
      'total_cost', (select coalesce(sum(i.qty_ordered * i.unit_cost),0)
                     from public.purchase_order_items i where i.po_id = po.id)
    ) as row, po.created_at
    from public.purchase_orders po
    left join public.suppliers s on s.id = po.supplier_id
    where po.org_id = public.current_org_id() and public.has_location_permission(po.location_id,'procurement.manage')
      and (p_location is null or po.location_id=p_location)
      and (p_status is null or po.status = p_status)
    order by po.created_at desc
    limit least(greatest(coalesce(p_limit,50),1),200)
  ) t;
$$;
revoke all on function public.list_purchase_orders(text,integer,uuid) from public,anon;
grant execute on function public.list_purchase_orders(text,integer,uuid) to authenticated,service_role;

drop function if exists public.procurement_overview();
CREATE OR REPLACE FUNCTION public.procurement_overview(p_location uuid default null) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'open_pos', (select count(*) from public.purchase_orders
                 where org_id = public.current_org_id() and (p_location is null or location_id=p_location) and public.has_location_permission(location_id,'procurement.manage') and status in ('draft','ordered')),
    'suppliers', (select count(*) from public.suppliers
                  where org_id = public.current_org_id() and is_active and public.has_permission('procurement.manage')),
    'wastage_value_30d', (select coalesce(round(sum(quantity*unit_cost),2),0)
                          from public.wastage_log
                          where org_id = public.current_org_id()
                            and (p_location is null or location_id=p_location) and public.has_location_permission(location_id,'procurement.manage') and created_at >= now() - interval '30 days')
  );
$$;
revoke all on function public.procurement_overview(uuid) from public,anon;
grant execute on function public.procurement_overview(uuid) to authenticated,service_role;


-- The same store guard applies to sibling inventory and purchase-item RPCs.
CREATE OR REPLACE FUNCTION public.log_temperature(p_location uuid, p_area text, p_temp numeric, p_min numeric DEFAULT NULL::numeric, p_max numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_breach boolean;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location_permission(p_location,'inventory.adjust') then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_area,'')),'') is null then raise exception 'Pick an area.'; end if;
  if p_temp is null then raise exception 'Enter a temperature.'; end if;

  v_breach := (p_min is not null and p_temp < p_min) or (p_max is not null and p_temp > p_max);

  insert into public.cold_chain_logs
    (org_id, location_id, area, temp_c, target_min, target_max, breach, note, actor_id)
  values (v_org, p_location, trim(p_area), p_temp, p_min, p_max, v_breach,
          nullif(trim(coalesce(p_note,'')),''), auth.uid());

  if v_breach then
    insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
    values (v_org, p_location, auth.uid(), 'coldchain.breach', 'location', p_location,
            jsonb_build_object('area', trim(p_area), 'temp', p_temp, 'min', p_min, 'max', p_max));
  end if;
  return v_breach;
end $$;

CREATE OR REPLACE FUNCTION public.log_wastage(p_location uuid, p_product uuid, p_qty numeric, p_reason text, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_name text; v_cost numeric; v_on_hand numeric; v_id uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location_permission(p_location,'inventory.adjust') then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if p_reason not in ('spoilage','expiry','damage','theft','count_adjustment','other') then
    raise exception 'Pick a valid reason.';
  end if;
  if p_qty is null or p_qty::text in ('NaN','Infinity','-Infinity') or p_qty <= 0 or p_qty>100000 then raise exception 'Invalid quantity.'; end if;
  select name, last_cost into v_name, v_cost from public.products where id = p_product and org_id = v_org for update;
  if v_name is null then raise exception 'Product not found.'; end if;

  v_on_hand := public.stock_available(p_location, p_product);
  if v_on_hand - p_qty < 0 then
    raise exception 'That would take stock below zero (on hand: %).', v_on_hand;
  end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, actor_id, note)
  values (v_org, p_location, p_product, -p_qty, 'waste', 'wastage', auth.uid(),
          p_reason || coalesce(' â€” ' || nullif(trim(coalesce(p_note,'')),''), ''));

  insert into public.wastage_log
    (org_id, location_id, product_id, product_name, quantity, reason, unit_cost, note, actor_id)
  values (v_org, p_location, p_product, v_name, p_qty, p_reason, coalesce(v_cost,0),
          nullif(trim(coalesce(p_note,'')),''), auth.uid())
  returning id into v_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,p_location,auth.uid(),'stock.wastage','product',p_product);
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.record_production(p_location uuid, p_product uuid, p_qty numeric, p_expiry date DEFAULT NULL::date, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_cost numeric; v_name text; v_batch uuid;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location_permission(p_location,'inventory.adjust') then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_qty is null or p_qty::text in ('NaN','Infinity','-Infinity') or p_qty <= 0 or p_qty>100000 then raise exception 'Invalid quantity.'; end if;
  select last_cost, name into v_cost, v_name from public.products where id = p_product and org_id = v_org for update;
  if v_name is null then raise exception 'Product not found.'; end if;

  insert into public.product_batches (
    org_id, location_id, product_id, batch_code, source,
    received_qty, remaining_qty, quantity, unit_cost, source_date, expiry_date, status, created_by
  ) values (
    v_org, p_location, p_product,
    'B-' || to_char((now() at time zone 'Asia/Kolkata'),'YYMMDD') || '-' ||
      lpad(nextval('public.batch_code_seq')::text,4,'0'),
    'production', p_qty, 0, p_qty, coalesce(v_cost,0),
    (now() at time zone 'Asia/Kolkata')::date, p_expiry, 'active', auth.uid()
  ) returning id into v_batch;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, actor_id, note, batch_id)
  values (v_org, p_location, p_product, p_qty, 'production', 'production', auth.uid(),
          nullif(trim(coalesce(p_note,'')),''), v_batch);
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,p_location,auth.uid(),'stock.production','product',p_product);
  return v_batch;
end $$;

CREATE OR REPLACE FUNCTION public.write_off_batch(p_batch uuid, p_reason text DEFAULT 'expiry'::text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; b record;
begin
  perform public.require_permission('inventory.adjust');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if p_reason not in ('spoilage','expiry','damage','theft','count_adjustment','other') then
    raise exception 'Pick a valid reason.';
  end if;
  select * into b from public.product_batches where id = p_batch and org_id = v_org for update;
  if b.id is null then raise exception 'Batch not found.'; end if;
  if not public.has_location_permission(b.location_id,'inventory.adjust') then raise exception 'Access denied.' using errcode='42501'; end if;
  if b.remaining_qty <= 0 then raise exception 'This batch has no stock left.'; end if;

  insert into public.stock_movements
    (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note, batch_id)
  values (v_org, b.location_id, b.product_id, -b.remaining_qty, 'waste', 'wastage', p_batch, auth.uid(),
          p_reason || ' â€” batch ' || b.batch_code || coalesce(' â€” ' || nullif(trim(coalesce(p_note,'')),''), ''),
          p_batch);

  insert into public.wastage_log
    (org_id, location_id, product_id, product_name, quantity, reason, unit_cost, note, actor_id)
  select v_org, b.location_id, b.product_id, p.name, b.remaining_qty, p_reason, b.unit_cost,
         'Batch ' || b.batch_code || coalesce(' â€” ' || nullif(trim(coalesce(p_note,'')),''), ''), auth.uid()
  from public.products p where p.id = b.product_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,b.location_id,auth.uid(),'batch.written_off','batch',p_batch);
end $$;

CREATE OR REPLACE FUNCTION public.remove_po_item(p_item uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_org uuid; v_status text; v_location uuid; v_po uuid;
begin
  perform public.require_permission('procurement.manage');
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  select po.status,po.location_id,po.id into v_status,v_location,v_po
    from public.purchase_order_items i join public.purchase_orders po on po.id = i.po_id
   where i.id = p_item and i.org_id = v_org for update of po;
  if v_status is null then raise exception 'Item not found.'; end if;
  if not public.has_location_permission(v_location,'procurement.manage') then raise exception 'Access denied.' using errcode='42501'; end if;
  if v_status <> 'draft' then raise exception 'You can only change a draft order.'; end if;
  delete from public.purchase_order_items where id = p_item and org_id = v_org;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id)
  values(v_org,v_location,auth.uid(),'purchase_order.item_removed','purchase_order',v_po);
end $$;
