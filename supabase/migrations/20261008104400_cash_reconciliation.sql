insert into public.role_capabilities(role,capability) values
  ('staff','cash.collect'),('manager','cash.collect'),
  ('manager','cash.close'),('accountant','cash.close') on conflict do nothing;

-- POS operates in the staff organization, not the public storefront organization.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.record_sale(uuid,uuid,public.sale_line[],text,numeric,text,uuid,numeric)'::regprocedure) into definition;
  if position('public.wallet_balance(p_loyalty_user)' in definition)=0 then raise exception 'POS wallet source changed; review migration.'; end if;
  execute replace(definition,'public.wallet_balance(p_loyalty_user)',
    '(select coalesce(sum(w.amount),0) from public.wallet_ledger w where w.org_id=v_org and w.user_id=p_loyalty_user)');
  select pg_get_functiondef('public.pos_loyalty_lookup(text)'::regprocedure) into definition;
  if position('public.wallet_balance(v_uid)' in definition)=0 then raise exception 'POS loyalty source changed; review migration.'; end if;
  execute replace(definition,'public.wallet_balance(v_uid)',
    '(select coalesce(sum(w.amount),0) from public.wallet_ledger w where w.org_id=v_org and w.user_id=v_uid)');
end $$;

create table public.cod_receipts (
  order_id uuid primary key references public.orders(id),
  org_id uuid not null references public.organizations(id),
  location_id uuid not null references public.locations(id),
  amount numeric(12,2) not null check (amount>0 and amount<=10000000),
  collected_by uuid not null references public.profiles(id),
  collected_at timestamptz not null default clock_timestamp()
);
create index cod_receipts_store_time on public.cod_receipts(location_id,collected_at);
create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  location_id uuid not null references public.locations(id),
  business_date date not null,
  expected numeric(14,2) not null,
  counted numeric(14,2) not null check(counted>=0 and counted<=100000000),
  difference numeric(14,2) generated always as (counted-expected) stored,
  note text check(length(note)<=500),
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default clock_timestamp(),
  unique(location_id,business_date)
);
alter table public.cod_receipts enable row level security;
alter table public.cash_closings enable row level security;
revoke all on public.cod_receipts,public.cash_closings from public,anon,authenticated;
grant select on public.cod_receipts,public.cash_closings to authenticated;
create policy cod_receipts_read on public.cod_receipts for select to authenticated using
  (org_id=public.current_org_id() and (public.has_location_permission(location_id,'cash.collect') or public.has_location_permission(location_id,'cash.close')));
create policy cash_closings_read on public.cash_closings for select to authenticated using
  (org_id=public.current_org_id() and public.has_location_permission(location_id,'cash.close'));

create function public.reject_cash_ledger_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Cash records are append-only.'; end $$;
revoke all on function public.reject_cash_ledger_change() from public,anon,authenticated;
create trigger cod_receipts_immutable before update or delete on public.cod_receipts for each row execute function public.reject_cash_ledger_change();
create trigger cash_closings_immutable before update or delete on public.cash_closings for each row execute function public.reject_cash_ledger_change();

-- Reuse actual POS cash tenders (after wallet redemption and change), not sales revenue.
-- Timestamp after the closing lock so an older transaction cannot backdate a receipt.
create function public.guard_cash_payment() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op<>'INSERT' then
    if old.method='cash' or (tg_op='UPDATE' and new.method='cash') then
      raise exception 'Cash records are append-only.';
    end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if new.method='cash' then
    perform pg_advisory_xact_lock(hashtextextended('cash:'||new.location_id::text,0));
    -- Trusted database restores preserve timestamps; user operations cannot backdate.
    if auth.uid() is not null or session_user not in ('postgres','supabase_admin') then
      new.created_at:=clock_timestamp();
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_cash_payment() from public,anon,authenticated;
create trigger payments_cash_guard before insert or update or delete on public.payments for each row execute function public.guard_cash_payment();

create function public.cash_locations() returns table(id uuid,name text,can_collect boolean,can_close boolean)
language sql stable security definer set search_path='' as $$
  select l.id,l.name,public.has_location_permission(l.id,'cash.collect'),public.has_location_permission(l.id,'cash.close')
  from public.locations l where l.type='store' and auth.uid() is not null
    and (public.has_location_permission(l.id,'cash.collect') or public.has_location_permission(l.id,'cash.close')) order by l.name,l.id;
$$;
create function public.collect_cod(p_order uuid,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; r public.cod_receipts; v_location uuid;
begin
  select location_id into v_location from public.orders where id=p_order and org_id=public.current_org_id();
  if auth.uid() is null or not coalesce(public.has_location_permission(v_location,'cash.collect'),false) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  -- ponytail: one cash lock per store; split by drawer when stores have independent tills.
  perform pg_advisory_xact_lock(hashtextextended('cash:'||v_location::text,0));
  select * into o from public.orders where id=p_order and org_id=public.current_org_id() for update;
  if o.id is null or o.location_id<>v_location then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_amount is null or not(p_amount>0 and p_amount<=10000000) or p_amount<>round(p_amount,2) or p_amount<>o.total then
    raise exception 'Collect the exact order total.';
  end if;
  select * into r from public.cod_receipts where order_id=o.id;
  if r.order_id is not null then return; end if;
  if o.payment_method<>'cod' or o.status<>'delivered' or o.is_paid then
    raise exception 'Only unpaid delivered COD orders can be collected.';
  end if;
  insert into public.cod_receipts(order_id,org_id,location_id,amount,collected_by,collected_at)
    values(o.id,o.org_id,o.location_id,p_amount,auth.uid(),clock_timestamp());
  update public.orders set is_paid=true,paid_at=clock_timestamp() where id=o.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(o.org_id,o.location_id,auth.uid(),'order.cod_collected','order',o.id,jsonb_build_object('amount',p_amount));
end $$;

create function public.cash_summary(p_location uuid,p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_from timestamptz; v_to timestamptz; v_cod numeric; v_pos numeric;
begin
  if auth.uid() is null or not(public.has_location_permission(p_location,'cash.collect') or public.has_location_permission(p_location,'cash.close')) then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  if p_date is null or p_date>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Choose today or a past business date.'; end if;
  v_from:=p_date::timestamp at time zone 'Asia/Kolkata'; v_to:=(p_date+1)::timestamp at time zone 'Asia/Kolkata';
  select coalesce(sum(amount),0) into v_cod from public.cod_receipts where location_id=p_location and collected_at>=v_from and collected_at<v_to;
  select coalesce(sum(amount),0) into v_pos from public.payments where location_id=p_location and method='cash' and created_at>=v_from and created_at<v_to;
  return jsonb_build_object('cod',v_cod,'pos',v_pos,'expected',v_cod+v_pos,
    'closing',case when public.has_location_permission(p_location,'cash.close') then
      (select to_jsonb(c) from public.cash_closings c where location_id=p_location and business_date=p_date) else null end,
    'outstanding_count',(select count(*) from public.orders where org_id=public.current_org_id() and location_id=p_location and status='delivered' and payment_method='cod' and not is_paid and total>0),
    'outstanding',coalesce((select jsonb_agg(x) from (select id,order_number,total,delivered_at from public.orders
      where org_id=public.current_org_id() and location_id=p_location and status='delivered' and payment_method='cod' and not is_paid and total>0
      order by delivered_at,id limit 100) x),'[]'::jsonb));
end $$;

create function public.close_cash_day(p_location uuid,p_date date,p_expected numeric,p_counted numeric,p_note text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.cash_closings; v_expected numeric; v_id uuid;
begin
  if auth.uid() is null or not public.has_location_permission(p_location,'cash.close') then raise exception 'Access denied.' using errcode='42501'; end if;
  -- ponytail: close completed IST days; add drawer sessions when shifts need same-day closing.
  if p_date is null or p_date>=(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Close a completed business day.'; end if;
  if p_counted is null or not(p_counted>=0 and p_counted<=100000000) or p_counted<>round(p_counted,2)
    or p_expected is null or not(p_expected>=0 and p_expected<=100000000) or p_expected<>round(p_expected,2) then raise exception 'Enter a valid cash amount.'; end if;
  if length(coalesce(p_note,''))>500 then raise exception 'Keep the note within 500 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash:'||p_location::text,0));
  select * into c from public.cash_closings where location_id=p_location and business_date=p_date;
  if c.id is not null then
    if c.counted=p_counted and c.expected=p_expected and coalesce(c.note,'')=btrim(coalesce(p_note,'')) then return c.id; end if;
    raise exception 'This cash day is already closed.';
  end if;
  v_expected:=(public.cash_summary(p_location,p_date)->>'expected')::numeric;
  if v_expected<>p_expected then raise exception 'Cash totals changed. Refresh before closing.'; end if;
  if p_counted<>v_expected and btrim(coalesce(p_note,''))='' then raise exception 'Explain the cash shortage or surplus.'; end if;
  insert into public.cash_closings(org_id,location_id,business_date,expected,counted,note,closed_by)
    values(public.current_org_id(),p_location,p_date,v_expected,p_counted,nullif(btrim(p_note),''),auth.uid()) returning id into v_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(public.current_org_id(),p_location,auth.uid(),'cash.day_closed','cash_closing',v_id,
      jsonb_build_object('date',p_date,'expected',v_expected,'counted',p_counted,'difference',p_counted-v_expected,'note',p_note));
  return v_id;
end $$;
revoke all on function public.cash_locations(),public.collect_cod(uuid,numeric),public.cash_summary(uuid,date),public.close_cash_day(uuid,date,numeric,numeric,text) from public,anon;
grant execute on function public.cash_locations(),public.collect_cod(uuid,numeric),public.cash_summary(uuid,date),public.close_cash_day(uuid,date,numeric,numeric,text) to authenticated;

create or replace function public.sales_by_payment(p_days integer default 30) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.require_permission('financials.read');
  select coalesce(jsonb_agg(jsonb_build_object('payment_method',payment_method,'orders',orders,'revenue',round(revenue,2)) order by revenue desc),'[]'::jsonb)
  from (select payment_method,count(*) orders,sum(total) revenue from public.orders
    where org_id=public.current_org_id() and is_paid and status<>'cancelled'
      and location_id=any(public.financial_report_locations())
      and coalesce(paid_at,placed_at)>=now()-make_interval(days=>greatest(coalesce(p_days,30),1)) group by payment_method) t;
$$;
