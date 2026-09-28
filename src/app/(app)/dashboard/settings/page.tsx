import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getAdminSettings } from "./actions";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  // Settings shape the whole storefront, so keep them to owners.
  if (!session.isOwner) redirect("/dashboard");

  const settings = await getAdminSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Configure your shop — delivery charges, contact details and business
          info for receipts.
        </p>
      </div>

      {settings ? (
        <SettingsForm initial={settings} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-ink-soft">
          Couldn&apos;t load settings. Refresh and try again.
        </p>
      )}
    </div>
  );
}
