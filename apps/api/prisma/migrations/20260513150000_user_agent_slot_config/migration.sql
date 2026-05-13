-- CreateTable
CREATE TABLE "UserAgentSlotConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "inferenceMode" "AgentInferenceMode" NOT NULL DEFAULT 'local',
    "baseUrl" TEXT,
    "hostedProvider" TEXT,
    "apiKey" TEXT,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAgentSlotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAgentSlotConfig_userId_slotKey_key" ON "UserAgentSlotConfig"("userId", "slotKey");

CREATE INDEX "UserAgentSlotConfig_userId_idx" ON "UserAgentSlotConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserAgentSlotConfig" ADD CONSTRAINT "UserAgentSlotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 自旧表回填：每条 agentModels 条目一行，继承该用户原「全局」推理字段
INSERT INTO "UserAgentSlotConfig" ("id", "userId", "slotKey", "inferenceMode", "baseUrl", "hostedProvider", "apiKey", "modelId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."userId",
    kv.key,
    c."inferenceMode",
    c."baseUrl",
    c."hostedProvider",
    c."apiKey",
    BTRIM(kv.value),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM "UserAgentConfig" c
CROSS JOIN LATERAL jsonb_each_text(c."agentModels") AS kv(key, value)
WHERE BTRIM(kv.value) <> '';

-- DropTable
DROP TABLE "UserAgentConfig";
