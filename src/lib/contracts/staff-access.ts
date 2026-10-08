export type StaffRole = "manager" | "staff" | "accountant";
export type StaffAccess = {
  people: { id: string; full_name: string | null; is_owner: boolean }[];
  locations: { id: string; name: string; type: string }[];
  memberships: { user_id: string; location_id: string; role: string }[];
  capabilities: { role: StaffRole; capability: string }[];
  audit: { id: number; actor_id: string; entity_id: string; event_type: string; created_at: string; payload: { before: string | boolean | null; after: string | boolean | null; reason?: string } }[];
};
export type ManagerDashboard = {
  locations: { id: string; name: string }[];
  stores: { id: string; name: string; overdue: number; open_orders: number; failed_deliveries: number; uncollected_cod: number; low_stock: number; expiring_batches: number; cash_variances: number }[];
  audit: { id: number; event_type: string; entity_type: string | null; created_at: string; location_id: string }[];
};
