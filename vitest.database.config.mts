import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  include: ["tests/database/**/*.test.ts"], environment: "node",
  fileParallelism: false, testTimeout: 20000, hookTimeout: 20000,
  reporters: ["default", "junit"], outputFile: { junit: "reports/database.xml" },
} });
