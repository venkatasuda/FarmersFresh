-- =====================================================================
-- Migration 0042: Farmers Fresh Pass — part 2 (pass_memberships)
--
-- Customer passes live in pass_memberships (the name 'memberships' was already
-- the staff<->location table). Repoints my_membership / start_membership /
-- activate_membership and the place_order membership block at pass_memberships.
--
-- Applied live to project bjevoybwufubtprkxbvb. Behaviour:
--   * pass_memberships: a customer's pass (pending_payment -> active on a
--     verified Razorpay payment); RLS scopes reads to the owner.
--   * my_membership() -> active pass (expiry, plan, discount %) or null.
--   * start_membership(plan) -> pending pass + amount for Razorpay.
--   * activate_membership(id, rp_order, rp_payment) -> service-role, sets active
--     and computes expiry from the plan duration.
--   * place_order(): an active member gets FREE delivery + the plan's % off the
--     subtotal (folded into discount; also recorded as member_discount in the
--     order.placed event).
-- =====================================================================

revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;
revoke all on function public.start_membership(uuid) from public, anon;
grant execute on function public.start_membership(uuid) to authenticated;
revoke all on function public.activate_membership(uuid,text,text) from public, anon, authenticated;

-- place_order recreated live with the pass_memberships benefit block; grants:
revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) to anon, authenticated;
