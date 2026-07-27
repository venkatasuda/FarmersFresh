-- =====================================================================
-- Migration 0062: Festive hampers / combo kits
--
-- Curated product bundles added to the basket in one tap. Applied live to
-- project bjevoybwufubtprkxbvb.
--   * hampers, hamper_items (RLS staff read; public reads via functions).
--   * get_hampers() / get_hamper(id) — customer (anon + authenticated).
--   * Seeded (once) with Weekend Biryani Kit, Festive Sweets & Tea Hamper,
--     South Indian Breakfast Kit — all built from the shop's own products.
-- =====================================================================
revoke all on function public.get_hampers() from public;
grant execute on function public.get_hampers() to anon, authenticated;
revoke all on function public.get_hamper(uuid) from public;
grant execute on function public.get_hamper(uuid) to anon, authenticated;
