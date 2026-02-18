-- AlterTable
ALTER TABLE "WhatsAppInstance" ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'disconnected',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WhatsAppInstance_userId_idx" ON "WhatsAppInstance"("userId");

-- CreateIndex
CREATE INDEX "WhatsAppInstance_status_idx" ON "WhatsAppInstance"("status");
