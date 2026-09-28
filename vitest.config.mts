import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests only — pure logic, no database, no Next runtime. The database
// suite has its own config (vitest.database.config.mts) and Playwright owns e2e.
export default defineConfig({
  resolve: {
    alias: {
      // Match the tsconfig "@/*" -> ./src alias so tests import like the app.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // src/server/* starts with import "server-only", which throws outside React
      // Server Components. Tests import those modules directly, so stub it here.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/supabase/**", "**/*.d.ts", "src/lib/env.ts"],
    },
  },
});
