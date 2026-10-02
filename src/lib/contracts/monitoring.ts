export const monitoringMetrics = [
  'ff_stuck_orders', 'ff_stale_unpaid_orders', 'ff_pending_refunds',
  'ff_payment_exceptions_24h', 'ff_failed_notifications_24h',
  'ff_skipped_notifications_24h', 'ff_stuck_notifications', 'ff_low_stock_products',
] as const;
export type MonitoringCounts = Record<(typeof monitoringMetrics)[number], number>;
