-- CreateTable
CREATE TABLE "conversation_responses" (
    "id" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "needsResponse" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_responses_needsResponse_idx" ON "conversation_responses"("needsResponse");

-- CreateIndex
CREATE INDEX "conversation_responses_lastMessageAt_idx" ON "conversation_responses"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_responses_remoteJid_key" ON "conversation_responses"("remoteJid");
