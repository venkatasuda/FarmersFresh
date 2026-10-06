import { Wordmark } from "@/components/brand";
import { signOut } from "@/features/auth/actions";
import { requireSession } from "@/server/auth/session";
import Link from "next/link";
import { StaffNavigation } from "@/features/dashboard/navigation/staff-navigation";
import { hasPermission } from "@/server/auth/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const [canReadFinancials, canManageOrders] = await Promise.all([
    hasPermission("financials.read"), hasPermission("orders.manage"),
  ]);

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
            <StaffNavigation session={session} canReadFinancials={canReadFinancials} canManageOrders={canManageOrders} />
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
