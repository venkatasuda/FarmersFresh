-- =====================================================================
-- Migration 0086: P1 — atomic coupon consumption in place_order.
-- place_order validated the coupon via preview_coupon (used_count < usage_limit)
-- and THEN did an unconditional `used_count = used_count + 1`. Two concurrent
-- orders both passed the check and both incremented, so a capped coupon
-- ("first 100 customers") could be redeemed past its limit. The increment is now
-- conditional on the cap and raises if the row is no longer claimable, so only
-- orders that actually claim a slot keep the discount.
--
-- Surgical transform over 0080's place_order body (avoids duplicating the whole
-- ~200-line function): replaces just the consume statement, aborts if the anchor
-- is missing, and is a no-op if the guard is already present. Applied live to
-- bjevoybwufubtprkxbvb and verified: sequential double-claim on a usage_limit=1
-- coupon => first succeeds, second refused, used_count caps at 1.
--
-- Note: the per_phone_limit check remains a count()-based read (a small race for
-- the same phone ordering concurrently), left as-is because the existing 3-open
-- and 6-per-hour throttles already bound it; the global cap was the money leak.
-- =====================================================================
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='place_order';
  if v_def is null then raise exception 'place_order not found'; end if;
  if position('used_count < usage_limit' in v_def) > 0 then return; end if;  -- already guarded

  v_new := replace(v_def,
    E'update public.coupons set used_count = used_count + 1\n      where org_id = p_org_id and upper(code) = upper(v_coupon);',
    E'update public.coupons set used_count = used_count + 1\n      where org_id = p_org_id and upper(code) = upper(v_coupon)\n        and (usage_limit is null or used_count < usage_limit);\n    if not found then raise exception ''Sorry — that code was just fully used.''; end if;');

  if v_new = v_def then raise exception 'coupon-consume anchor not found in place_order'; end if;
  execute v_new;
end $mig$;
