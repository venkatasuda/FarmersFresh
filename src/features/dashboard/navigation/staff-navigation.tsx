import Link from "next/link";
import type { Session } from "@/lib/contracts/auth-session";

export function StaffNavigation({ session, canReadFinancials, canManageOrders, canAdjustInventory = false, canManagePurchasing = false }: {
  session: Session;
  canReadFinancials: boolean;
  canManageOrders: boolean;
  canAdjustInventory?: boolean;
  canManagePurchasing?: boolean;
}) {
  return (<nav aria-label="Staff navigation" className="scrollbar-thin flex max-w-[70vw] items-center gap-1 overflow-x-auto text-sm">
              <NavLink href="/dashboard">Overview</NavLink>
              {canManageOrders ? <>
                <NavLink href="/dashboard/pos" primary>Counter</NavLink>
                <NavLink href="/dashboard/orders">Orders</NavLink>
              </> : null}
              {session.isOwner || session.memberships.some(m => m.role === "manager" && m.locationType === "store") ? (
                <NavLink href="/dashboard/monitoring">Monitoring</NavLink>
              ) : null}
              {canReadFinancials && !session.isOwner ? <NavLink href="/dashboard/financials">Financials</NavLink> : null}
              {session.isOwner ? (
                <>
                  <Menu
                    label="Operations"
                    items={[
                      ["/dashboard/reorder", "Reorder"],
                      ["/dashboard/production", "Production"],
                      ["/dashboard/purchasing", "Purchasing"],
                      ["/dashboard/expiry", "Expiry"],
                      ["/dashboard/wastage", "Wastage"],
                      ["/dashboard/coldchain", "Cold chain"],
                      ["/dashboard/stock", "Stock"],
                      ["/dashboard/deliveries", "Deliveries"],
                      ["/dashboard/returns", "Returns"],
                    ]}
                  />
                  <Menu
                    label="Money"
                    items={[
                      ["/dashboard/sales", "Sales"],
                      ["/dashboard/financials", "Financials"],
                      ["/dashboard/credit", "Credit"],
                    ]}
                  />
                  <Menu
                    label="Catalogue"
                    items={[
                      ["/dashboard/catalogue", "Catalogue"],
                      ["/dashboard/coupons", "Coupons"],
                      ["/dashboard/banners", "Banners"],
                      ["/dashboard/delivery", "Delivery"],
                      ["/dashboard/recipes", "Recipes"],
                      ["/dashboard/traceability", "Traceability"],
                    ]}
                  />
                  <NavLink href="/dashboard/support">Support</NavLink>
                  <NavLink href="/dashboard/settings">Settings</NavLink>
                </>
              ) : canManageOrders ? (
                <>
                  <NavLink href="/dashboard/deliveries">Deliveries</NavLink>
                  <NavLink href="/dashboard/credit">Credit</NavLink>
                  <NavLink href="/dashboard/returns">Returns</NavLink>
                  <NavLink href="/dashboard/support">Support</NavLink>
                </>
              ) : null}
              {!session.isOwner && canAdjustInventory ? <NavLink href="/dashboard/stock">Stock</NavLink> : null}
              {!session.isOwner && canManagePurchasing ? <NavLink href="/dashboard/purchasing">Purchasing</NavLink> : null}
              <NavLink href="/">Shop</NavLink>
            </nav>);
}

function NavLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 ${
        primary
          ? "font-medium text-brand-700 hover:text-brand-800"
          : "text-ink-soft hover:bg-brand-50 hover:text-brand-700"
      }`}
    >
      {children}
    </Link>
  );
}

// Native <details> dropdown — no JS, no library. Closes on outside click via
// the browser's own behaviour; groups the long owner nav into three menus.
function Menu({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <details className="group relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 py-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
        {label}
        <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-44 rounded-xl border border-line bg-surface p-1 shadow-lift">
        {items.map(([href, text]) => (
          <Link
            key={href}
            href={href}
            className="block rounded-lg px-3 py-2 text-ink-soft hover:bg-brand-50 hover:text-brand-700"
          >
            {text}
          </Link>
        ))}
      </div>
    </details>
  );
}
