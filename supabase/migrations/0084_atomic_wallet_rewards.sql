-- =====================================================================
-- Migration 0084: P0 — atomic reward claims (double-spend / overspend).
-- redeem_gift_card, redeem_referral and reveal_scratch_card were
-- read-check-then-write: two near-simultaneous calls could both pass the
-- "unused?" check and each credit the wallet. Replaced with atomic conditional
-- claims — `UPDATE ... WHERE <flag> IS NULL RETURNING` — so only the request
-- that actually flips the row credits; a losing/duplicate call sees "already
-- used". tip_delivery could overspend the wallet the same way (two tips both
-- pass the balance check); it now locks the user's wallet rows before checking,
-- serialising this user's spends. Applied live to bjevoybwufubtprkxbvb and
-- verified with a rolled-back double-redeem (exactly one credit).
-- =====================================================================
create or replace function public.redeem_gift_card(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_org uuid; c record; v_val numeric;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please sign in.'); end if;
  v_org := public.storefront_org_id();

  select * into c from public.gift_cards
   where upper(code) = upper(trim(coalesce(p_code,''))) and org_id = v_org;
  if c.id is null then return jsonb_build_object('ok', false, 'message', 'That gift card code isn''t valid.'); end if;

  update public.gift_cards set redeemed_by = v_uid, redeemed_at = now()
   where id = c.id and redeemed_at is null
   returning value into v_val;
  if not found then return jsonb_build_object('ok', false, 'message', 'This gift card has already been used.'); end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_uid, v_val, 'gift', c.code);
  return jsonb_build_object('ok', true, 'value', v_val);
end $function$;

create or replace function public.redeem_referral(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_org uuid; v_owner uuid; v_mine record;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in first.'); end if;
  v_org := public.storefront_org_id();

  perform public.my_wallet();
  select * into v_mine from public.referrals where user_id = v_uid;
  if v_mine.referred_by is not null then
    return jsonb_build_object('ok', false, 'message', 'You''ve already used a referral code.');
  end if;

  select user_id into v_owner from public.referrals where upper(code) = upper(trim(p_code));
  if v_owner is null then return jsonb_build_object('ok', false, 'message', 'That code isn''t valid.'); end if;
  if v_owner = v_uid then return jsonb_build_object('ok', false, 'message', 'You can''t use your own code.'); end if;

  -- Atomic: only the first request that sets referred_by gets the reward.
  update public.referrals set referred_by = v_owner
   where user_id = v_uid and referred_by is null;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'You''ve already used a referral code.');
  end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_org, v_uid, 50, 'referral_welcome', v_mine.code);
  return jsonb_build_object('ok', true, 'message', '₹50 added to your wallet!');
end $function$;

create or replace function public.reveal_scratch_card(p_id uuid)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_pts int; v_org uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Please sign in.'; end if;

  update public.scratch_cards set revealed_at = now()
   where id = p_id and user_id = v_uid and revealed_at is null
   returning reward_points, org_id into v_pts, v_org;
  if found then
    insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
    values (v_org, v_uid, v_pts, 'reward', 'SCRATCH:' || p_id::text);
    return v_pts;
  end if;

  -- Already revealed (or not the caller's card): return existing points, no re-credit.
  select reward_points into v_pts from public.scratch_cards where id = p_id and user_id = v_uid;
  if v_pts is null then raise exception 'Card not found.'; end if;
  return v_pts;
end $function$;

create or replace function public.tip_delivery(p_number text, p_points integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_o record;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Sign in to tip with points.'); end if;
  if coalesce(p_points,0) <= 0 then return jsonb_build_object('ok', false, 'message', 'Choose an amount.'); end if;
  select * into v_o from public.orders where upper(order_number) = upper(trim(coalesce(p_number,''))) and user_id = v_uid;
  if v_o.id is null then return jsonb_build_object('ok', false, 'message', 'Order not found.'); end if;
  if v_o.status <> 'delivered' then return jsonb_build_object('ok', false, 'message', 'You can tip once it''s delivered.'); end if;

  -- Serialise this user's wallet spends so two tips can't both pass the check.
  perform 1 from public.wallet_ledger where user_id = v_uid for update;
  if public.wallet_balance(v_uid) < p_points then
    return jsonb_build_object('ok', false, 'message', 'Not enough points for that tip.');
  end if;

  insert into public.wallet_ledger (org_id, user_id, amount, reason, ref)
  values (v_o.org_id, v_uid, -p_points, 'tip', v_o.order_number);
  update public.orders set tip_points = tip_points + p_points where id = v_o.id;
  return jsonb_build_object('ok', true, 'tip', p_points);
end $function$;
