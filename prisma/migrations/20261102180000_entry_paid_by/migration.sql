-- Who marked a block as paid: its owner, or an admin marking a range for the whole
-- team. The marks made so far stay without an author.
-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "paidById" TEXT;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
