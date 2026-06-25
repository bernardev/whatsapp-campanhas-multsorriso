-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('VESPERA', 'DIA');
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "templateName" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_logs_createdAt_idx" ON "reminder_logs"("createdAt");
CREATE INDEX "reminder_logs_appointmentId_idx" ON "reminder_logs"("appointmentId");
CREATE INDEX "reminder_logs_status_idx" ON "reminder_logs"("status");

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
