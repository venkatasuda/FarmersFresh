-- =====================================================================
-- Farmers Fresh — Migration 0013: Collect against a customer's account
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- The credit ledger (the khata) is for COUNTER regulars, restaurants and
-- bulk buyers who take goods now and settle their account weekly or monthly.
-- Online orders are pay-on-delivery, so they never sit on credit.
--
-- When such a customer settles up — pays ₹8,000 off what they owe across many
-- sales — that is NOT a payment against one sale. It is a payment against the
-- ACCOUNT. So this inserts a payment with a customer_id and NO sale_id.
-- `customer_balances` (migration 0001) sums all of a customer's payments, so
-- the outstanding figure drops correctly without touching any single sale's
-- paid status.
--
-- Verified: two credit sales → owes ₹12,750 → pays ₹8,000 → owes ₹4,750.
-- =====================================================================

create or replace function public.record_account_payment(
  p_customer_id uuid, p_amount numeric, p_method text default 'cash', p_note text default null
)
returns numeric  -- the new outstanding balance
language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; v_loc uuid; v_outstanding numeric;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount greater than zero.'; end if;

  select location_id into v_loc from public.customers
   where id = p_customer_id and org_id = v_org;
  if v_loc is null then raise exception 'Customer not found.'; end if;
  if not public.has_location(v_loc) then raise exception 'You do not have access to that customer.'; end if;

  insert into public.payments (org_id, location_id, sale_id, customer_id, amount, method, created_by)
  values (v_org, v_loc, null, p_customer_id, p_amount, coalesce(p_method,'cash'), auth.uid());

  insert into public.events (org_id, location_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, v_loc, auth.uid(), 'payment.received', 'customer', p_customer_id,
          jsonb_build_object('amount', p_amount, 'method', p_method, 'note', p_note));

  select outstanding into v_outstanding from public.customer_balances where customer_id = p_customer_id;
  return coalesce(v_outstanding, 0);
end $$;

revoke all on function public.record_account_payment(uuid,numeric,text,text) from public, anon;
grant execute on function public.record_account_payment(uuid,numeric,text,text) to authenticated;
