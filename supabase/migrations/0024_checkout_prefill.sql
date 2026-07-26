-- =====================================================================
-- Farmers Fresh — Migration 0024: Checkout prefill for logged-in customers
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Returns the signed-in customer's own details to pre-fill checkout: name and
-- email from the account, phone + address from their most recent order
-- (matched by email or phone). Security definer, scoped strictly to the
-- caller's own auth record — never anyone else's history.
--
-- Full body applied live; grants below.
-- =====================================================================

revoke all on function public.my_checkout_prefill() from public, anon;
grant execute on function public.my_checkout_prefill() to authenticated;
