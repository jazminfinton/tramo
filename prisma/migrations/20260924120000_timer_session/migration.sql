-- CreateTable
CREATE TABLE "TimerSession" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "doneSeconds" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerSession_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "TimerSession_projectId_idx" ON "TimerSession"("projectId");

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
