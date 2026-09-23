import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";

import { PrismaClient } from "@/generated/prisma/client";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

/**
 * A throwaway Postgres for tests: PGlite (Postgres compiled to WASM, running
 * in-process) with every migration applied. Tests that depend on real SQL —
 * constraints, the partial unique index, time-zone math — run here instead of
 * against mocks. No Docker, no network, no shared state between test files.
 */
export async function createTestDb() {
  const pglite = new PGlite();

  const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of migrations) {
    await pglite.exec(readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
  }

  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) });

  return {
    prisma,
    /** Empties every table, keeping the schema. Call it between tests. */
    async reset() {
      const { rows } = await pglite.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      const tables = rows.map(({ tablename }) => `"${tablename}"`).join(", ");
      if (tables) await pglite.exec(`TRUNCATE ${tables} CASCADE`);
    },
    async close() {
      await prisma.$disconnect();
      await pglite.close();
    },
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Inserts a user the way Better Auth would (it generates string ids). */
export function createUser(db: TestDb, email: string, name = email.split("@")[0] ?? email) {
  return db.prisma.user.create({ data: { id: crypto.randomUUID(), email, name } });
}
