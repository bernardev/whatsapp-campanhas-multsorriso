-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");
