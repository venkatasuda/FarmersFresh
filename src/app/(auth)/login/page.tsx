import { LoginPageView } from "@/features/auth/staff-login-view";

export const metadata = {
  title: "Sign in · Farmers Fresh",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // Next.js 16: searchParams is a Promise.
  const { next, error } = await searchParams;

  return <LoginPageView next={next} error={error} />;
}
