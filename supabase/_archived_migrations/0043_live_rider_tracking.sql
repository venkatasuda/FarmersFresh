-- =====================================================================
-- Migration 0043: Live rider tracking + ETA
--
-- The assigned rider shares GPS while out for delivery; the customer's track
-- page (which polls track_order) shows a moving marker + a rider-set ETA.
-- Location is only exposed while out_for_delivery.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * orders gains rider_lat, rider_lng, rider_location_at, eta_minutes,
--     eta_set_at.
--   * update_rider_location(order, lat, lng, eta?) — staff-scoped.
--   * track_order() recreated to include a 'tracking' block while out for
--     delivery (unchanged access: order number + matching phone).
-- =====================================================================

revoke all on function public.update_rider_location(uuid,double precision,double precision,int) from public, anon;
grant execute on function public.update_rider_location(uuid,double precision,double precision,int) to authenticated;
