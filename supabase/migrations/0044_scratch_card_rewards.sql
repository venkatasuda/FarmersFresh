-- =====================================================================
-- Migration 0044: Gamified scratch-card rewards
--
-- Every delivered order earns a scratch card worth a few bonus loyalty points.
-- Minted on DELIVERY (via reward_on_delivery) so it can't be farmed with
-- unpaid/cancelled orders; the reward is decided at creation and only credited
-- when the customer reveals it.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * scratch_cards table (+ RLS own).
--   * my_scratch_cards() — unrevealed cards (reward hidden until revealed).
--   * reveal_scratch_card(id) — credits points once, returns the reward.
--   * reward_on_delivery() extended to mint one card per delivered order.
-- =====================================================================

revoke all on function public.my_scratch_cards() from public, anon;
grant execute on function public.my_scratch_cards() to authenticated;
revoke all on function public.reveal_scratch_card(uuid) from public, anon;
grant execute on function public.reveal_scratch_card(uuid) to authenticated;
revoke all on function public.reward_on_delivery() from public, anon, authenticated;
