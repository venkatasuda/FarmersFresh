-- VEN-8: a signed payment.captured with no amount marked the order paid.
-- Treat a missing amount like a wrong one: never settle it.
CREATE OR REPLACE FUNCTION public.settle_razorpay_payment(p_payment_id text, p_rp_order text, p_amount integer, p_event text, p_raw jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_order record; v_mem record; v_status text; v_org uuid; v_target text; v_tid uuid;
begin
  if coalesce(p_payment_id,'') = '' then return 'no_payment_id'; end if;

  -- Idempotency gate: first writer wins; a replay finds the row and stops.
  insert into public.payment_events (razorpay_payment_id, razorpay_order_id, amount, event, raw)
  values (p_payment_id, p_rp_order, p_amount, p_event, p_raw)
  on conflict (razorpay_payment_id) do nothing;
  if not found then return 'duplicate'; end if;

  select id, total, org_id into v_order from public.orders where razorpay_order_id = p_rp_order limit 1;
  if v_order.id is not null then
    if p_amount is null or p_amount <> round(v_order.total * 100) then
      v_status := 'amount_mismatch';                 -- never settle a mismatched amount
    else
      perform public.mark_order_paid(v_order.id, p_rp_order, p_payment_id);
      v_status := 'order_paid';
    end if;
    v_target := 'order'; v_tid := v_order.id; v_org := v_order.org_id;
  else
    select id, org_id into v_mem from public.pass_memberships where razorpay_order_id = p_rp_order limit 1;
    if v_mem.id is not null then
      perform public.activate_membership(v_mem.id, p_rp_order, p_payment_id);
      v_status := 'membership_activated';
      v_target := 'membership'; v_tid := v_mem.id; v_org := v_mem.org_id;
    else
      v_status := 'unmatched';
    end if;
  end if;

  update public.payment_events
     set status = v_status, target_type = v_target, target_id = v_tid, org_id = v_org
   where razorpay_payment_id = p_payment_id;
  return v_status;
end $function$

;
