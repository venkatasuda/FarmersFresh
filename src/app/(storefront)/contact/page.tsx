import { ContactPageView } from "@/features/content/contact-view";
import { getSupportContacts } from "@/server/customers/queries";

export const metadata = { title: "Contact · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  // Show the shop's real alert phone if one is set, so the contact number
  // matches where the business actually answers.
  const org = await getSupportContacts();

  const phone = (org as { notify_phone: string | null } | null)?.notify_phone;
  const email = (org as { notify_email: string | null } | null)?.notify_email;

  return <ContactPageView phone={phone} email={email} />;
}
