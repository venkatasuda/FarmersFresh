-- =====================================================================
-- Farmers Fresh — Migration 0023: Customer accounts ("my orders")
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Customers log in with their phone via Supabase Phone OTP. They have NO
-- profile and NO org — they are not staff — so the existing orders_read policy
-- returns nothing for them. This security-definer function is the one
-- controlled window: it returns only the orders whose contact_phone matches
-- the phone on the caller's own verified token. A customer sees their own
-- history and no one else's.
--
-- Phone matching compares the LAST 10 digits, because Supabase stores the phone
-- in international form (919876543210) while orders store the local 10 digits.
--
-- ⚠ SETUP: sending OTP codes requires Supabase → Authentication → Providers →
--    Phone to be ENABLED with an SMS provider (MSG91/Twilio — the same kind of
--    provider used for order notifications). Until then the login UI shows a
--    friendly "phone login isn't switched on yet" and guests can still order.
-- =====================================================================

create or replace function public.my_orders()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_phone text; v_rows jsonb;
begin
  select regexp_replace(u.phone, '\D', '', 'g') into v_phone
  from auth.users u where u.id = auth.uid();

  if v_phone is null or length(v_phone) < 10 then
    return '[]'::jsonb;
  end if;
  v_phone := right(v_phone, 10);

  select coalesce(jsonb_agg(o order by o.placed_at desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'order_number', ord.order_number,
      'status', ord.status,
      'total', ord.total,
      'placed_at', ord.placed_at,
      'item_count', (select count(*) from public.order_items oi where oi.order_id = ord.id),
      'items', (select string_agg(oi.product_name, ', ') from public.order_items oi where oi.order_id = ord.id)
    ) as o, ord.placed_at
    from public.orders ord
    where right(ord.contact_phone, 10) = v_phone
    order by ord.placed_at desc
    limit 50
  ) t;

  return v_rows;
end $$;

revoke all on function public.my_orders() from public, anon;
grant execute on function public.my_orders() to authenticated;
