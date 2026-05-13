-- CreateEnum
CREATE TYPE "AgentInferenceMode" AS ENUM ('local', 'hosted');

-- CreateTable
CREATE TABLE "UserAgentConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inferenceMode" "AgentInferenceMode" NOT NULL DEFAULT 'local',
    "baseUrl" TEXT,
    "hostedProvider" TEXT,
    "apiKey" TEXT,
    "agentModels" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAgentConfig_userId_key" ON "UserAgentConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserAgentConfig" ADD CONSTRAINT "UserAgentConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 兼容仅改 schema、未落库的库：无此列时补默认空对象，便于从 JSON 回填推理配置。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentInference" JSONB NOT NULL DEFAULT '{}';

-- Data: 每用户一行配置（原 agentModels + agentInference）
INSERT INTO "UserAgentConfig" ("id", "userId", "inferenceMode", "baseUrl", "hostedProvider", "apiKey", "agentModels", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    CASE
        WHEN u."agentInference"->>'mode' = 'hosted' THEN 'hosted'::"AgentInferenceMode"
        ELSE 'local'::"AgentInferenceMode"
    END,
    NULLIF(BTRIM(u."agentInference"->>'baseUrl'), ''),
    NULLIF(BTRIM(u."agentInference"->>'hostedProvider'), ''),
    NULLIF(BTRIM(u."agentInference"->>'apiKey'), ''),
    COALESCE(u."agentModels", '{}'::jsonb),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM "User" u;

-- Drop old JSON blobs on User
ALTER TABLE "User" DROP COLUMN IF EXISTS "agentInference";
ALTER TABLE "User" DROP COLUMN "agentModels";
