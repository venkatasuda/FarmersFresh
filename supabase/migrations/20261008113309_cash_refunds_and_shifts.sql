insert into public.role_capabilities(role,capability) values ('manager','cash.refund'),('accountant','cash.refund') on conflict do nothing;
create table public.cash_refunds (
  return_id uuid primary key references public.returns(id), order_id uuid not null references public.orders(id),
  org_id uuid not null references public.organizations(id), location_id uuid not null references public.locations(id),
  amount numeric(12,2) not null check(amount>0 and amount<=10000000), note text not null check(length(btrim(note)) between 1 and 500),
  refunded_by uuid not null references public.profiles(id), refunded_at timestamptz not null default clock_timestamp()
);
create index cash_refunds_store_time on public.cash_refunds(location_id,refunded_at);
alter table public.cash_refunds enable row level security;
revoke all on public.cash_refunds from anon,authenticated;
grant select on public.cash_refunds to authenticated;
create policy cash_refunds_read on public.cash_refunds for select to authenticated using(org_id=public.current_org_id() and public.has_location_permission(location_id,'cash.close'));
create trigger cash_refunds_immutable before update or delete on public.cash_refunds for each row execute function public.reject_cash_ledger_change();

-- One refund channel per order. Existing wallet refund entry points use the same order lock.
create function public.guard_cash_wallet_refund() returns trigger language plpgsql security definer set search_path='' as $$
declare v_order uuid;
begin
  if new.reason='refund' then
    select id into v_order from public.orders where org_id=new.org_id and order_number=new.ref for update;
    if exists(select 1 from public.cash_refunds where order_id=v_order) then raise exception 'This order already has a cash refund.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_cash_wallet_refund() from public,anon,authenticated;
create trigger guard_cash_wallet_refund before insert on public.wallet_ledger for each row execute function public.guard_cash_wallet_refund();

create function public.refund_return_cash(p_return uuid,p_amount numeric,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.returns; o public.orders; c public.cash_refunds; v_location uuid; v_received numeric;
begin
  select j.location_id into v_location from public.returns e join public.orders j on j.id=e.order_id where e.id=p_return and e.org_id=public.current_org_id();
  if auth.uid() is null or not coalesce(public.has_location_permission(v_location,'cash.refund'),false) then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_amount is null or not(p_amount>0 and p_amount<=10000000) or p_amount<>round(p_amount,2) then raise exception 'Enter a valid cash amount.'; end if;
  if p_note is null or length(btrim(p_note)) not between 1 and 500 then raise exception 'Give a refund reason within 500 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash:'||v_location::text,0));
  select * into r from public.returns where id=p_return and org_id=public.current_org_id() for update;
  select * into o from public.orders where id=r.order_id and org_id=r.org_id for update;
  if o.location_id is distinct from v_location then raise exception 'Access denied.' using errcode='42501'; end if;
  select * into c from public.cash_refunds where return_id=r.id;
  if c.return_id is not null then
    if c.amount=p_amount and c.note=btrim(p_note) then return; end if;
    raise exception 'This return already has a cash refund.';
  end if;
  select amount into v_received from public.cod_receipts where order_id=o.id;
  if r.status='rejected' or r.refund_points>0 or o.status<>'delivered' or not o.is_paid or o.payment_method<>'cod' or v_received is null then
    raise exception 'Only collected COD returns can be refunded in cash.';
  end if;
  if exists(select 1 from public.wallet_ledger where org_id=o.org_id and ref=o.order_number and reason='refund' and amount>0) then
    raise exception 'This order already has a wallet refund.';
  end if;
  if p_amount+(select coalesce(sum(amount),0) from public.cash_refunds where order_id=o.id)>v_received then raise exception 'Refund exceeds collected cash.'; end if;
  insert into public.cash_refunds(return_id,order_id,org_id,location_id,amount,note,refunded_by,refunded_at)
    values(r.id,o.id,o.org_id,v_location,p_amount,btrim(p_note),auth.uid(),clock_timestamp());
  update public.returns set status='approved',staff_note=btrim(p_note),resolved_by=auth.uid(),resolved_at=clock_timestamp() where id=r.id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload)
    values(o.org_id,v_location,auth.uid(),'return.cash_refunded','return',r.id,jsonb_build_object('amount',p_amount,'note',btrim(p_note),'order_id',o.id));
end $$;

create table public.cash_shifts (
  id uuid primary key, org_id uuid not null references public.organizations(id), location_id uuid not null references public.locations(id),
  opening numeric(14,2) not null check(opening>=0 and opening<=100000000), opened_by uuid not null references public.profiles(id), opened_at timestamptz not null,
  closed_by uuid references public.profiles(id), closed_at timestamptz, expected numeric(14,2), counted numeric(14,2) check(counted>=0 and counted<=100000000),
  note text check(length(note)<=500), difference numeric(14,2) generated always as(counted-expected) stored,
  check ((closed_at is null and closed_by is null and expected is null and counted is null) or (closed_at>=opened_at and closed_by is not null and expected is not null and counted is not null))
);
-- ponytail: one shared till per store; introduce drawer IDs when independent tills are needed.
create unique index cash_shifts_one_open on public.cash_shifts(location_id) where closed_at is null;
alter table public.cash_shifts enable row level security;
revoke all on public.cash_shifts from anon,authenticated;
grant select on public.cash_shifts to authenticated;
create policy cash_shifts_read on public.cash_shifts for select to authenticated using(org_id=public.current_org_id() and public.has_location_permission(location_id,'cash.close'));

create function public.cash_shift_summary(p_location uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.cash_shifts; v_receipts numeric; v_refunds numeric;
begin
  if auth.uid() is null or not public.has_location_permission(p_location,'cash.close') then raise exception 'Access denied.' using errcode='42501'; end if;
  select * into s from public.cash_shifts where location_id=p_location and closed_at is null;
  select coalesce(sum(amount),0) into v_receipts from (
    select amount from public.cod_receipts where location_id=p_location and collected_at>=s.opened_at
    union all select amount from public.payments where location_id=p_location and method='cash' and created_at>=s.opened_at) x;
  select coalesce(sum(amount),0) into v_refunds from public.cash_refunds where location_id=p_location and refunded_at>=s.opened_at;
  return jsonb_build_object('active',case when s.id is not null then to_jsonb(s)||jsonb_build_object('expected',s.opening+v_receipts-v_refunds,'receipts',v_receipts,'refunds',v_refunds) else null end,
    'recent',coalesce((select jsonb_agg(x) from(select id,opening,opened_at,closed_at,expected,counted,difference,note from public.cash_shifts where location_id=p_location and closed_at is not null order by closed_at desc limit 20) x),'[]'::jsonb));
end $$;
create function public.open_cash_shift(p_id uuid,p_location uuid,p_opening numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cash_shifts;
begin
  if auth.uid() is null or not public.has_location_permission(p_location,'cash.close') then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_id is null or p_opening is null or not(p_opening>=0 and p_opening<=100000000) or p_opening<>round(p_opening,2) then raise exception 'Enter a valid cash amount.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash:'||p_location::text,0));
  select * into s from public.cash_shifts where id=p_id;
  if s.id is not null then
    if s.location_id=p_location and s.org_id=public.current_org_id() and s.opening=p_opening then return s.id; end if;
    raise exception 'This request was already used for a different change.';
  end if;
  if exists(select 1 from public.cash_shifts where location_id=p_location and closed_at is null) then raise exception 'Close the active till shift first.'; end if;
  insert into public.cash_shifts(id,org_id,location_id,opening,opened_by,opened_at) values(p_id,public.current_org_id(),p_location,p_opening,auth.uid(),clock_timestamp());
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload) values(public.current_org_id(),p_location,auth.uid(),'cash.shift_opened','cash_shift',p_id,jsonb_build_object('opening',p_opening));
  return p_id;
end $$;
create function public.close_cash_shift(p_id uuid,p_expected numeric,p_counted numeric,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cash_shifts; v_location uuid; v_expected numeric;
begin
  select location_id into v_location from public.cash_shifts where id=p_id and org_id=public.current_org_id();
  if auth.uid() is null or not coalesce(public.has_location_permission(v_location,'cash.close'),false) then raise exception 'Access denied.' using errcode='42501'; end if;
  if p_counted is null or not(p_counted>=0 and p_counted<=100000000) or p_counted<>round(p_counted,2)
    or p_expected is null or not(p_expected between -100000000 and 100000000) or p_expected<>round(p_expected,2) then raise exception 'Enter a valid cash amount.'; end if;
  if length(coalesce(p_note,''))>500 then raise exception 'Keep the note within 500 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash:'||v_location::text,0));
  select * into s from public.cash_shifts where id=p_id for update;
  if s.closed_at is not null then
    if s.expected=p_expected and s.counted=p_counted and coalesce(s.note,'')=btrim(coalesce(p_note,'')) then return s.id; end if;
    raise exception 'This till shift is already closed.';
  end if;
  v_expected:=(public.cash_shift_summary(v_location)->'active'->>'expected')::numeric;
  if v_expected<>p_expected then raise exception 'Cash totals changed. Refresh before closing.'; end if;
  if p_counted<>v_expected and btrim(coalesce(p_note,''))='' then raise exception 'Explain the cash shortage or surplus.'; end if;
  update public.cash_shifts set expected=v_expected,counted=p_counted,note=nullif(btrim(p_note),''),closed_by=auth.uid(),closed_at=clock_timestamp() where id=p_id;
  insert into public.events(org_id,location_id,actor_id,event_type,entity_type,entity_id,payload) values(s.org_id,v_location,auth.uid(),'cash.shift_closed','cash_shift',p_id,jsonb_build_object('expected',v_expected,'counted',p_counted,'difference',p_counted-v_expected,'note',p_note));
  return p_id;
end $$;
revoke all on function public.refund_return_cash(uuid,numeric,text),public.cash_shift_summary(uuid),public.open_cash_shift(uuid,uuid,numeric),public.close_cash_shift(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.refund_return_cash(uuid,numeric,text),public.cash_shift_summary(uuid),public.open_cash_shift(uuid,uuid,numeric),public.close_cash_shift(uuid,numeric,numeric,text) to authenticated;

-- Scope both the returns list and the existing RLS read path to the exact store capability.
create or replace function public.get_returns(p_all boolean default false) returns setof public.returns language sql stable security definer set search_path='' as $$
  select r.* from public.returns r join public.orders o on o.id=r.order_id where r.org_id=public.current_org_id()
    and (public.has_location_permission(o.location_id,'orders.manage') or public.has_location_permission(o.location_id,'cash.refund'))
    and (p_all or r.status='requested') order by r.created_at desc limit 200;
$$;
drop policy returns_staff_read on public.returns;
create policy returns_staff_read on public.returns for select to authenticated using(org_id=public.current_org_id() and exists(select 1 from public.orders o where o.id=order_id and (public.has_location_permission(o.location_id,'orders.manage') or public.has_location_permission(o.location_id,'cash.refund'))));

do $$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef('public.cash_summary(uuid,date)'::regprocedure);
  if position('''outstanding_count''' in v_definition)=0 then raise exception 'Cash summary changed; review migration.'; end if;
  v_definition:=replace(v_definition,'''outstanding_count''', $sql$
    'refunds',(select coalesce(sum(amount),0) from public.cash_refunds where location_id=p_location and refunded_at>=v_from and refunded_at<v_to),
    'refund_requests',case when public.has_location_permission(p_location,'cash.refund') then
      coalesce((select jsonb_agg(x) from(select r.id,r.order_number,c.amount-(select coalesce(sum(f.amount),0) from public.cash_refunds f where f.order_id=o.id) as collected from public.returns r
        join public.orders o on o.id=r.order_id join public.cod_receipts c on c.order_id=o.id
        where r.org_id=public.current_org_id() and o.location_id=p_location and o.status='delivered' and r.status in ('requested','approved') and r.refund_points=0
          and not exists(select 1 from public.cash_refunds f where f.return_id=r.id)
          and c.amount>(select coalesce(sum(f.amount),0) from public.cash_refunds f where f.order_id=o.id)
          and not exists(select 1 from public.wallet_ledger w where w.org_id=o.org_id and w.ref=o.order_number and w.reason='refund' and w.amount>0)
        order by r.created_at limit 100) x),'[]'::jsonb) else '[]'::jsonb end,
    'outstanding_count'$sql$);
  execute v_definition;
end $$;
