import { CustomerCreditPageView } from "@/features/dashboard/credit/detail-view";
import { requireSession } from "@/server/auth/session";
import { getCustomerBalance, getCustomerLedger } from "@/server/payments/credit";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const c = await getCustomerBalance(id);
  return { title: c ? `${c.name} · Farmers Fresh` : "Not found" };
}

export default async function CustomerCreditPage({ params }: Props) {
  await requireSession();
  const { id } = await params;

  const [balance, ledger] = await Promise.all([
    getCustomerBalance(id),
    getCustomerLedger(id),
  ]);

  if (!balance) notFound();

  return <CustomerCreditPageView balance={balance} id={id} ledger={ledger} />;
}
