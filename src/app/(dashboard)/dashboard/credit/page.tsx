import { CreditPageView } from "@/features/dashboard/credit/credit-view";
import { requireSession } from "@/server/auth/session";
import { getDebtors } from "@/server/payments/credit";

export const metadata = { title: "Credit ledger · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CreditPage() {
  await requireSession();
  const debtors = (await getDebtors()).filter((d) => d.outstanding > 0);

  const totalOwed = debtors.reduce((s, d) => s + d.outstanding, 0);

  return <CreditPageView totalOwed={totalOwed} debtors={debtors} />;
}
