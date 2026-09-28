import { Leaf } from "@/app/brand";
import { signIn } from "./actions";

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

  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
            <Leaf className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Farmers<span className="text-brand-600">Fresh</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to your account</p>
        </div>

        <form
          action={signIn}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
        >
          <input type="hidden" name="next" value={next ?? "/dashboard"} />

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-ink-soft">
          Floor staff don&apos;t sign in here — tap your card at the station.
        </p>
      </div>
    </div>
  );
}
