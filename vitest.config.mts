// Unit and integration tests run in Node, not in a browser: they cover pure
// logic (lib/, Zod schemas, the DAL) and database behavior on PGlite (see
// lib/testing/db.ts).
//
// Async Server Components can NOT be tested with Vitest (see
// node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md), so pages
// are covered by the Playwright suite in e2e/.
//
// A file that needs a DOM opts in with `// @vitest-environment happy-dom`, so
// the rest of the suite doesn't pay for it.

import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the `@/*` alias, so tests import exactly like production code.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside a React Server Components build. Tests
      // exercise server modules directly, so it resolves to its no-op build.
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    // Tests live next to the code they cover.
    include: ["{app,components,features,lib,i18n}/**/*.test.{ts,tsx}"],
    // PGlite boots a WASM Postgres per test file; give it room on cold starts.
    hookTimeout: 30_000,
  },
});
