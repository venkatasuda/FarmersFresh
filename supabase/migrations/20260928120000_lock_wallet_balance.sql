-- VEN-6: wallet_balance(p_user) let any signed-in user read any customer's balance.
-- No client code calls it; every internal caller (my_wallet, place_order,
-- pos_loyalty_lookup, record_sale, tip_delivery) is SECURITY DEFINER, so
-- revoking client access closes the hole without touching them.
-- Customers read their own balance through my_wallet().
revoke execute on function public.wallet_balance(uuid) from public, anon, authenticated;
