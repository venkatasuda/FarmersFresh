/**
 * Reads the Supabase config and fails loudly if it's missing.
 *
 * The obvious version of this is `process.env.NEXT_PUBLIC_SUPABASE_URL!` — but
 * that `!` is a lie to the compiler. When the value is absent you get
 * "Your project's URL and Key are required to create a Supabase client"
 * thrown from inside a library, which tells you nothing about which file to
 * create. This says exactly what's wrong and what to do.
 */
const PLACEHOLDERS = ["YOUR-PROJECT", "PASTE_YOUR", "your-anon-public-key"];

function required(name: string, value: string | undefined): string {
  const unfilled = PLACEHOLDERS.some((p) => value?.includes(p));

  if (!value || value.trim() === "" || unfilled) {
    throw new Error(
      `Missing ${name}.\n\n` +
        `Create E:\\FarmersFresh\\.env.local (copy .env.example) and fill in\n` +
        `your values from Supabase → Project Settings → Data API / API Keys.\n` +
        `Then restart the dev server — Next.js only reads .env files on boot.`
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
