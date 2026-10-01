-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "pausedAt" TIMESTAMPTZ(3),
ADD COLUMN     "pausedSeconds" INTEGER NOT NULL DEFAULT 0;

-- An entry now stays open across pauses. Prisma does not model CHECK
-- constraints, so these guarantees live only in this migration.

-- Paused time can't be negative.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_paused_seconds_not_negative" CHECK ("pausedSeconds" >= 0);

-- Only an open entry can be paused, and never before it started.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_paused_only_while_open" CHECK (
  "pausedAt" IS NULL OR ("endedAt" IS NULL AND "pausedAt" >= "startedAt")
);

-- A finished entry has time worked left once its pauses are taken out.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_worked_time_positive" CHECK (
  "endedAt" IS NULL OR EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) > "pausedSeconds"
);
