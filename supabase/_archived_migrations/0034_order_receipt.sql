-- =====================================================================
-- Migration 0034: Digital receipt for an order
--
-- Returns everything a receipt needs — line items with unit prices, the money
-- breakdown, payment method/status, and loyalty points earned. Access mirrors
-- track_order: the logged-in owner (auth.uid = user_id) OR anyone who knows the
-- order number AND the contact phone. Never world-readable — a receipt carries
-- the customer's name, address and phone.
--
-- Applied live to project bjevoybwufubtprkxbvb. See pg_get_functiondef for the
-- exact body; the grants are below.
-- =====================================================================

revoke all on function public.get_order_receipt(text, text) from public;
grant execute on function public.get_order_receipt(text, text) to anon, authenticated;
