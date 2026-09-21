import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "reports/**",
    "playwright-report/**",
    "test-results/**",
    ".ci-recovery/**",
  ]),
  {
    rules: {
      // This app deliberately reads browser-only state (localStorage, feature
      // detection, timers) in a mount effect and calls setState — that value
      // isn't available during SSR/render, so the effect IS the correct place.
      // The react-hooks v6 "set-state-in-effect" rule flags that legitimate,
      // hydration-safe pattern, so we turn it off. The other hooks rules
      // (purity, rules-of-hooks, exhaustive-deps, etc.) stay on.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
