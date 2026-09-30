import { HelpPageView } from "@/features/help/help-view";
import { getStoreSettings } from "@/server/settings/queries";
import { getCurrentUser } from "@/server/customers/queries";

export const metadata = { title: "Help & support · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    getStoreSettings(),
  ]);

  return <HelpPageView settings={settings} user={user} />;
}
