-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "participant" TEXT,
    "pushName" TEXT,
    "messageText" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_messageId_key" ON "conversation_messages"("messageId");

-- CreateIndex
CREATE INDEX "conversation_messages_instanceId_remoteJid_timestamp_idx" ON "conversation_messages"("instanceId", "remoteJid", "timestamp");

-- CreateIndex
CREATE INDEX "conversation_messages_remoteJid_idx" ON "conversation_messages"("remoteJid");

-- CreateIndex
CREATE INDEX "conversation_messages_timestamp_idx" ON "conversation_messages"("timestamp");
