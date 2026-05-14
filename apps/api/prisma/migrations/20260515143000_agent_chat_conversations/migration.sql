-- CreateTable
CREATE TABLE "AgentChatConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentChatConversation_projectId_updatedAt_idx" ON "AgentChatConversation"("projectId", "updatedAt");

-- AddForeignKey
ALTER TABLE "AgentChatConversation" ADD CONSTRAINT "AgentChatConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (nullable during backfill)
ALTER TABLE "AgentChatMessage" ADD COLUMN "conversationId" TEXT;

-- One legacy conversation per project that already had messages
INSERT INTO "AgentChatConversation" ("id", "projectId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, dp."projectId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "projectId" FROM "AgentChatMessage") AS dp;

UPDATE "AgentChatMessage" AS msg
SET "conversationId" = conv.id
FROM "AgentChatConversation" AS conv
WHERE msg."projectId" = conv."projectId";

ALTER TABLE "AgentChatMessage" ALTER COLUMN "conversationId" SET NOT NULL;

CREATE INDEX "AgentChatMessage_conversationId_createdAt_idx" ON "AgentChatMessage"("conversationId", "createdAt");

ALTER TABLE "AgentChatMessage" ADD CONSTRAINT "AgentChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
