import { defineConfig } from "vitest/config";

// Database tests run against a real Postgres (a local `supabase start`), so they
// are serial and get a generous timeout. Connection comes from SUPABASE_DB_URL
// (exported by scripts/ci/export-local-env.mjs).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/database/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
