-- CreateTable
CREATE TABLE "InvitationProject" (
    "invitationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'TRACKER',

    CONSTRAINT "InvitationProject_pkey" PRIMARY KEY ("invitationId","projectId")
);

-- CreateIndex
CREATE INDEX "InvitationProject_projectId_idx" ON "InvitationProject"("projectId");

-- AddForeignKey
ALTER TABLE "InvitationProject" ADD CONSTRAINT "InvitationProject_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationProject" ADD CONSTRAINT "InvitationProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
