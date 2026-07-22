-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "invitedEmail" TEXT;

-- CreateIndex
CREATE INDEX "Membership_invitedEmail_idx" ON "Membership"("invitedEmail");
