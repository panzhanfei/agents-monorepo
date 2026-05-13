-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "gitUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agentModels" JSONB NOT NULL DEFAULT '{}';
