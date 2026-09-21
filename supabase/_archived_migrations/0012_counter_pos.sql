-- =====================================================================
-- Farmers Fresh — Migration 0012: Counter POS
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- The point of this migration: a walk-in sale must draw down the SAME stock
-- ledger the website sells from. Without it the two channels drift — you sell
-- 5 kg at the counter, the site still thinks it's there, and someone orders
-- online what's already gone. record_sale writes the sale, the money and the
-- stock movement in one transaction.
--
-- DELIBERATE DIFFERENCE from the online path: a counter sale is allowed to
-- take stock NEGATIVE. The sale physically happened — refusing to record it
-- would be lying about reality. A negative number signals the count was off,
-- it is not an error to block. (Online orders still refuse to oversell,
-- because there the goods have NOT left yet.)
--
-- Builds on the sales / sale_items / payments tables from migration 0001. The
-- recalc_sale_payment trigger keeps payment_status correct from the payment
-- row, so this never sets it by hand.
-- =====================================================================

create type public.sale_line as (
  product_id uuid,
  quantity   numeric,
  unit_price numeric
);

create or replace function public.record_sale(
  p_location uuid, p_customer_id uuid, p_lines public.sale_line[],
  p_method text, p_amount_paid numeric, p_note text default null
)
returns table (sale_id uuid, total numeric, change numeric)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_org uuid; v_sale uuid; v_line public.sale_line;
  v_total numeric(12,2) := 0; v_count int; v_pay numeric(12,2); v_name text;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then raise exception 'You do not have access to that till.'; end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then raise exception 'Nothing to sell — the cart is empty.'; end if;

  -- A credit or partial sale must name the customer, or there is no one to
  -- chase for the balance. This is the entire point of the credit ledger.
  if p_customer_id is null and p_amount_paid < (
    select coalesce(sum(round(l.quantity * l.unit_price, 2)), 0) from unnest(p_lines) l
  ) then
    raise exception 'Choose a customer for a credit or part-paid sale.';
  end if;

  insert into public.sales (org_id, location_id, customer_id, total, created_by)
  values (v_org, p_location, p_customer_id, 0, auth.uid()) returning id into v_sale;

  foreach v_line in array p_lines loop
    select p.name into v_name from public.products p
     where p.id = v_line.product_id and p.org_id = v_org and p.is_active;
    if v_name is null then raise exception 'One of those items is not for sale.'; end if;
    if v_line.quantity <= 0 then raise exception 'Quantity must be more than zero.'; end if;
    if v_line.unit_price < 0 then raise exception 'Price cannot be negative.'; end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale, v_line.product_id, v_line.quantity, v_line.unit_price);

    -- Draw down the shared ledger. Negative allowed here — see the header.
    insert into public.stock_movements
      (org_id, location_id, product_id, delta, reason, ref_type, ref_id, actor_id, note)
    values (v_org, p_location, v_line.product_id, -v_line.quantity, 'sale', 'sale', v_sale, auth.uid(), 'Counter sale');
  end loop;

  select coalesce(sum(si.line_total), 0) into v_total from public.sale_items si where si.sale_id = v_sale;
  update public.sales s set total = v_total where s.id = v_sale;

  -- Bank at most the total; hand the rest back as change.
  v_pay := least(coalesce(p_amount_paid, 0), v_total);
  if v_pay > 0 then
    insert into public.payments (org_id, location_id, sale_id, customer_id, amount, method, created_by)
    values (v_org, p_location, v_sale, p_customer_id, v_pay, coalesce(p_method, 'cash'), auth.uid());
  end if;

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, p_location, auth.uid(), 'sale.created', 'sale', v_sale,
          jsonb_build_object('total', v_total, 'paid', v_pay, 'method', p_method,
                             'customer', p_customer_id, 'note', p_note));

  return query select v_sale, v_total, greatest(coalesce(p_amount_paid, 0) - v_total, 0)::numeric;
end $$;

revoke all on function public.record_sale(uuid,uuid,public.sale_line[],text,numeric,text) from public, anon;
grant execute on function public.record_sale(uuid,uuid,public.sale_line[],text,numeric,text) to authenticated;

-- Find a customer by phone or create one on the spot — the counter can't stop
-- to fill a full form mid-queue.
create or replace function public.upsert_customer(p_location uuid, p_name text, p_phone text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; v_id uuid; v_phone text;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.has_location(p_location) then raise exception 'You do not have access to that location.'; end if;
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s|-|\+91', '', 'g');
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number.'; end if;
  select id into v_id from public.customers where org_id = v_org and phone = v_phone limit 1;
  if v_id is null then
    insert into public.customers (org_id, location_id, name, phone, type)
    values (v_org, p_location, coalesce(nullif(trim(p_name),''), 'Customer'), v_phone, 'regular')
    returning id into v_id;
  end if;
  return v_id;
end $$;

revoke all on function public.upsert_customer(uuid,text,text) from public, anon;
grant execute on function public.upsert_customer(uuid,text,text) to authenticated;
