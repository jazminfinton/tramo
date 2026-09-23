import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See README → Environment variables.");
}

// Pooled connection (the host ends in -pooler). Prisma 7 requires a driver adapter.
const adapter = new PrismaNeon({ connectionString });

// Reuse the client across hot reloads in development; otherwise every reload
// opens a new pool and exhausts the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
