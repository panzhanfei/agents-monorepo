-- AlterTable
ALTER TABLE "AgentChatConversation" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex (复合索引替代单列排序索引)
DROP INDEX IF EXISTS "AgentChatConversation_projectId_updatedAt_idx";

-- CreateIndex
CREATE INDEX "AgentChatConversation_projectId_pinned_updatedAt_idx" ON "AgentChatConversation"("projectId", "pinned", "updatedAt");
