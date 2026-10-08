import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { getStaffAccess } from "@/server/auth/staff-access";
import { StaffAccessView } from "@/features/dashboard/staff/staff-access-view";
export const metadata = { title: "Staff access · Farmers Fresh" };
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const session = await requireSession();
  if (!session.isOwner) notFound();
  return <StaffAccessView data={await getStaffAccess()} currentUser={session.userId} />;
}
