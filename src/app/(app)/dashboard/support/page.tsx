import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getTickets } from "./actions";
import { SupportList } from "./support-list";

export const metadata = { title: "Support · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireSession();
  const { all } = await searchParams;
  const showAll = all === "1";
  const rows = await getTickets(showAll);
  const open = rows.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Support</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {showAll ? "Everything, newest first" : "Open messages"}
            {open > 0 && !showAll ? (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                {open} open
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/dashboard/support"
            className={`rounded-lg px-3 py-1.5 ${showAll ? "border border-line text-ink-soft" : "bg-brand-600 text-white"}`}
          >
            Open
          </Link>
          <Link
            href="/dashboard/support?all=1"
            className={`rounded-lg px-3 py-1.5 ${showAll ? "bg-brand-600 text-white" : "border border-line text-ink-soft"}`}
          >
            All
          </Link>
        </div>
      </div>
      <SupportList rows={rows} />
    </div>
  );
}
