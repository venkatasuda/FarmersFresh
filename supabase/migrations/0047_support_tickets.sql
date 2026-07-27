-- =====================================================================
-- Migration 0047: In-app help centre (support tickets)
--
-- A logged-in customer raises a question/issue (optionally about an order);
-- staff reply and resolve. Customers read their own; staff read their org's.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * support_tickets (+ RLS: customer own, staff org).
--   * create_support_ticket(subject, message, order_number?) — customer.
--   * get_support_tickets(all?) / resolve_support_ticket(id, reply) — staff.
-- =====================================================================
revoke all on function public.create_support_ticket(text,text,text) from public, anon;
grant execute on function public.create_support_ticket(text,text,text) to authenticated;
revoke all on function public.get_support_tickets(boolean) from public, anon;
grant execute on function public.get_support_tickets(boolean) to authenticated;
revoke all on function public.resolve_support_ticket(uuid,text) from public, anon;
grant execute on function public.resolve_support_ticket(uuid,text) to authenticated;
