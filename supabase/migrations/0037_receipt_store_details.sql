-- =====================================================================
-- Migration 0037: Business details on receipts
--
-- get_order_receipt() now also returns the shop's store block (name, GSTIN,
-- business address, support phone) from the organization, so a receipt reads as
-- a proper invoice once the owner fills those in under Settings. Access control
-- is unchanged (owner-by-login, or order number + matching phone).
--
-- Applied live to project bjevoybwufubtprkxbvb; body via pg_get_functiondef.
-- =====================================================================

-- Grants unchanged from 0034:
revoke all on function public.get_order_receipt(text, text) from public;
grant execute on function public.get_order_receipt(text, text) to anon, authenticated;
