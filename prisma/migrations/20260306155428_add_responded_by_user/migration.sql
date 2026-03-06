-- AlterTable
ALTER TABLE "conversation_responses" ADD COLUMN     "respondedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "conversation_responses_respondedByUserId_idx" ON "conversation_responses"("respondedByUserId");

-- AddForeignKey
ALTER TABLE "conversation_responses" ADD CONSTRAINT "conversation_responses_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
