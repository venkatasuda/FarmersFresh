import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    environment: "node", clearMocks: true, restoreMocks: true,
    coverage: {
      provider: "v8", reportOnFailure: true, reporter: ["text", "lcov", "json-summary"],
      include: ["lib/guard.ts", "lib/format.ts", "app/api/razorpay/webhook/route.ts", "app/api/razorpay/verify/route.ts", "app/api/razorpay/order/route.ts", "app/api/razorpay/membership/route.ts"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
