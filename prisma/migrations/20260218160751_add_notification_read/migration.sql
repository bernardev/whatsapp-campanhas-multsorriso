-- AlterTable
ALTER TABLE "conversation_responses" ADD COLUMN     "notificationRead" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "conversation_responses_notificationRead_idx" ON "conversation_responses"("notificationRead");
