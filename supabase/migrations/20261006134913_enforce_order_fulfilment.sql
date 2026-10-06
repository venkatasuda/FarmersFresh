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
