-- VEN-10: anyone who knew an order id could set its delivery pin.
-- Now the caller must also give the order's contact phone (same proof as track_order),
-- which works for guest checkout too.
drop function public.attach_order_location(uuid, double precision, double precision);

create function public.attach_order_location(p_order_id uuid, p_phone text, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return;
  end if;
  update public.orders
     set address_lat = p_lat, address_lng = p_lng
   where id = p_order_id
     and contact_phone = regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g')
     and address_lat is null and placed_at > now() - interval '30 minutes';
end $$;

revoke all on function public.attach_order_location(uuid, text, double precision, double precision) from public;
grant execute on function public.attach_order_location(uuid, text, double precision, double precision) to anon, authenticated, service_role;
