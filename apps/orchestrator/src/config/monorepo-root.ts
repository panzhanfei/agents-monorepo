import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 本文件位于 `apps/orchestrator/src/config/*`，据此上溯到 monorepo 根。
 * 优先使用 `AGENTS_MONOREPO_ROOT`（与 `@agents/logger` 启动时注入一致）。
 */
const resolveMonorepoRootFromThisFile = (thisFileUrl: string): string => {
  const entryDir = path.dirname(fileURLToPath(thisFileUrl));
  const orchestratorRoot = path.resolve(entryDir, '..', '..');
  return path.resolve(orchestratorRoot, '..', '..');
};

export const getOrchestratorMonorepoRoot = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const fromEnv = env.AGENTS_MONOREPO_ROOT?.trim() ?? '';
  if (fromEnv !== '') {
    return path.resolve(fromEnv);
  }
  return resolveMonorepoRootFromThisFile(import.meta.url);
};
