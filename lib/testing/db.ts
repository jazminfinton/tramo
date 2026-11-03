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
  // Prisma writes dates as UTC without an offset, which holds on a UTC session,
  // like Neon's. PGlite starts on the machine's zone, and then SQL time-zone math
  // would be off by that zone, here and not in production.
  await pglite.exec("SET TIME ZONE 'UTC'");

  const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of migrations) {
    await pglite.exec(readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
  }

  const logged = new PrismaClient({ adapter: new PrismaPGlite(pglite), log: [{ emit: "event", level: "query" }] });
  let recording: string[] | null = null;
  logged.$on("query", (event) => recording?.push(event.query));
  const prisma = logged as unknown as PrismaClient;

  return {
    prisma,
    /** The statements Prisma sends while `run` runs: how much a query costs the database. */
    async statementsOf(run: () => Promise<unknown>) {
      recording = [];
      await run();
      const sent = recording;
      recording = null;
      return sent;
    },
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
