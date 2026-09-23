import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Overrides the default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artifacts. The HTML report ships its own minified bundle, and
    // without this ESLint lints it as if it were ours.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    // Generated Prisma client.
    "generated/**",
  ]),
]);

export default eslintConfig;
