-- =====================================================================
-- Migration 0088: P1 — atomic claiming for the notification outbox worker.
-- The send-notifications worker SELECTed status='pending' then sent + marked
-- each row. Two overlapping runs (scheduler double-fire, or a run that crashed
-- mid-batch and got retried) both selected the same rows and sent duplicate
-- emails/SMS/WhatsApp. claim_notifications() flips pending -> 'sending' under
-- FOR UPDATE SKIP LOCKED and returns only the rows THIS caller claimed, so
-- concurrent workers get disjoint sets and a row is sent once. A worker that
-- dies mid-send leaves a row 'sending'; those are reclaimed after 15 minutes
-- (claimed_at) so nothing is stranded. service_role only.
-- The status check gains 'sending'. The edge function (supabase/functions/
-- send-notifications) now calls this RPC instead of selecting pending directly.
-- Applied live to bjevoybwufubtprkxbvb and verified: two concurrent claims
-- return disjoint single rows, a third returns none, both rows flip to sending.
-- =====================================================================
alter table public.notifications add column if not exists claimed_at timestamptz;

alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status = any (array['pending','sending','sent','failed','skipped']));

create or replace function public.claim_notifications(p_limit int default 25)
returns table(id bigint, channel text, recipient text, template text, payload jsonb)
language sql security definer set search_path = public as $$
  update public.notifications n
     set status = 'sending', claimed_at = now(), attempts = attempts + 1
   where n.id in (
     select c.id from public.notifications c
      where c.status = 'pending'
         or (c.status = 'sending' and c.claimed_at < now() - interval '15 minutes')
      order by c.created_at
      for update skip locked
      limit greatest(coalesce(p_limit, 25), 1)
   )
  returning n.id, n.channel, n.recipient, n.template, n.payload;
$$;

revoke all on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
