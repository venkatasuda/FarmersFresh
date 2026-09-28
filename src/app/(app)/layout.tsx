import Link from "next/link";
import { Wordmark } from "@/app/brand";
import { signOut } from "@/app/login/actions";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      {/* Thin green rule under the bar — brand presence without turning the
          whole chrome green, which would fight the data below it. */}
      <header className="border-b-2 border-brand-600 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label="Farmers Fresh — dashboard">
              <Wordmark subdued />
            </Link>
            <nav className="scrollbar-thin flex max-w-[70vw] items-center gap-1 overflow-x-auto text-sm">
              <NavLink href="/dashboard">Overview</NavLink>
              <NavLink href="/dashboard/pos" primary>
                Counter
              </NavLink>
              <NavLink href="/dashboard/orders">Orders</NavLink>
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
              ) : (
                <>
                  <NavLink href="/dashboard/deliveries">Deliveries</NavLink>
                  <NavLink href="/dashboard/credit">Credit</NavLink>
                  <NavLink href="/dashboard/stock">Stock</NavLink>
                  <NavLink href="/dashboard/returns">Returns</NavLink>
                  <NavLink href="/dashboard/support">Support</NavLink>
                </>
              )}
              <NavLink href="/">Shop</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {session.fullName ?? session.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main data-dash className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
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
