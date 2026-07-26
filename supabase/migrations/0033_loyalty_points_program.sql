-- =====================================================================
-- Migration 0033: Loyalty points program (German-supermarket style)
--
-- One clear loyalty currency: POINTS, where 1 point = ₹1. Customers earn
-- 1 point per ₹100 spent (this REPLACES the old 2% wallet cashback) and can
-- redeem points 1:1 as a discount, online OR at the counter by scanning their
-- QR loyalty card. Points live in the existing wallet_ledger (reason 'points'
-- to earn, 'redeemed' to spend) — because 1 point = ₹1, the rupee balance IS
-- the points balance.
--
-- Applied live to project bjevoybwufubtprkxbvb. Key objects:
--   * reward_on_delivery(): earns floor(total/100) points on delivery
--     (referral reward of 50 points unchanged).
--   * pos_loyalty_lookup(code): staff-only; resolves a scanned loyalty/referral
--     code to the member + their points balance.
--   * record_sale(...): gains p_loyalty_user + p_points_redeem so a counter
--     sale can redeem points (1pt=₹1 tender) and earn points (1 per ₹100 net).
-- =====================================================================

-- Full bodies were applied live; see pg_get_functiondef for the exact source.

-- reward_on_delivery(): 1 point per ₹100 (trigger fn — not directly callable).
revoke all on function public.reward_on_delivery() from public, anon, authenticated;

-- pos_loyalty_lookup(code): staff resolve a scanned card; customer role can't
-- (current_org_id() is null for a plain customer, so the body raises).
revoke all on function public.pos_loyalty_lookup(text) from public, anon;
grant execute on function public.pos_loyalty_lookup(text) to authenticated;

-- record_sale gained p_loyalty_user + p_points_redeem (old 6-arg form dropped).
revoke all on function public.record_sale(uuid,uuid,sale_line[],text,numeric,text,uuid,numeric) from public, anon;
grant execute on function public.record_sale(uuid,uuid,sale_line[],text,numeric,text,uuid,numeric) to authenticated;
