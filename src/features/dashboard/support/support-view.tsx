import { SupportList } from "@/features/dashboard/support/support-list";
import Link from "next/link";

type SupportPageViewProps = {
  showAll: boolean;
  open: number;
  rows: import("@/lib/contracts/staff-support").Ticket[];
};

export function SupportPageView({ showAll, open, rows }: SupportPageViewProps) {
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
