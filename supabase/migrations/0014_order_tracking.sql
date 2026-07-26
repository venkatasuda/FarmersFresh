-- =====================================================================
-- Farmers Fresh — Migration 0014: Public order tracking
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Lets a customer check their own order without an account. Security is the
-- whole design: orders hold names, phones and addresses, and `anon` has no
-- SELECT on the table (migration 0003). This security-definer function returns
-- an order ONLY when the caller gives BOTH the order number AND the matching
-- phone. Number alone reveals nothing — stopping anyone from walking the
-- FF-YYMMDD-NNNN sequence to harvest customers. "Not found" and "wrong phone"
-- return the same null, so a number is never confirmed to a stranger.
-- =====================================================================

create or replace function public.track_order(p_number text, p_phone text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_order record; v_phone text; v_items jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');
  if coalesce(trim(p_number), '') = '' or v_phone !~ '^[6-9][0-9]{9}$' then
    return null;
  end if;

  select o.id, o.order_number, o.status, o.total, o.subtotal, o.delivery_fee,
         o.placed_at, o.confirmed_at, o.delivered_at, o.delivery_slot,
         o.contact_name, o.cancelled_reason
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

  return jsonb_build_object(
    'order_number', v_order.order_number, 'status', v_order.status,
    'total', v_order.total, 'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee, 'placed_at', v_order.placed_at,
    'confirmed_at', v_order.confirmed_at, 'delivered_at', v_order.delivered_at,
    'delivery_slot', v_order.delivery_slot, 'contact_name', v_order.contact_name,
    'cancelled_reason', v_order.cancelled_reason,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text,text) from public;
grant execute on function public.track_order(text,text) to anon, authenticated;
