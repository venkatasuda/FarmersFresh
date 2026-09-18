-- =====================================================================
-- Migration 0078: Razorpay webhook — authoritative payment reconciliation.
-- The browser /verify path is best-effort UX; the webhook is the source of
-- truth so a paid-but-tab-closed order still settles. Idempotent via the unique
-- razorpay_payment_id plus the already-idempotent mark_order_paid /
-- activate_membership. Amount is cross-checked against the order total.
-- Applied live to project bjevoybwufubtprkxbvb.
-- =====================================================================
create table if not exists public.payment_events (
  id                  uuid primary key default gen_random_uuid(),
  razorpay_payment_id text not null unique,
  razorpay_order_id   text,
  amount              integer,
  event               text,
  target_type         text,
  target_id           uuid,
  org_id              uuid,
  status              text,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);
alter table public.payment_events enable row level security;

create or replace function public.settle_razorpay_payment(
  p_payment_id text, p_rp_order text, p_amount integer, p_event text, p_raw jsonb
)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_order record; v_mem record; v_status text; v_org uuid; v_target text; v_tid uuid;
begin
  if coalesce(p_payment_id,'') = '' then return 'no_payment_id'; end if;

  insert into public.payment_events (razorpay_payment_id, razorpay_order_id, amount, event, raw)
  values (p_payment_id, p_rp_order, p_amount, p_event, p_raw)
  on conflict (razorpay_payment_id) do nothing;
  if not found then return 'duplicate'; end if;

  select id, total, org_id into v_order from public.orders where razorpay_order_id = p_rp_order limit 1;
  if v_order.id is not null then
    if p_amount is not null and p_amount <> round(v_order.total * 100) then
      v_status := 'amount_mismatch';
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
end $$;
revoke all on function public.settle_razorpay_payment(text,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.settle_razorpay_payment(text,text,integer,text,jsonb) to service_role;

create or replace function public.payment_reconciliation(p_days int default 7)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', razorpay_payment_id, 'order_id', razorpay_order_id,
    'amount', amount, 'status', status, 'target', target_type, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from public.payment_events
  where org_id = public.current_org_id()
    and created_at >= now() - make_interval(days => greatest(coalesce(p_days,7),1));
$$;
revoke all on function public.payment_reconciliation(int) from public, anon;
grant execute on function public.payment_reconciliation(int) to authenticated;
