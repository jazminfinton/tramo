import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local on its own; the Prisma CLI doesn't. Load both, with
// .env.local taking precedence.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations run over the direct (non-pooled) connection. It's optional here
  // so `prisma generate` works on a fresh clone before .env.local exists.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
