-- When a person marked a block of theirs as paid. Every block that exists starts
-- unpaid, so nothing changes until someone marks one.
-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "paidAt" TIMESTAMPTZ(3);

-- Only a finished entry can be marked: an open one still has hours to come.
-- Prisma does not model CHECK constraints, so this one is added by hand.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_paid_only_when_finished" CHECK ("paidAt" IS NULL OR "endedAt" IS NOT NULL);
