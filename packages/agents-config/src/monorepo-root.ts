import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 与 `@agents/logger` 一致：入口位于 `apps/<app>/src/*.ts` 时解析 monorepo 根目录 */
export const resolveMonorepoRootFromEntry = (importMetaUrl: string): string => {
  const entryDir = path.dirname(fileURLToPath(importMetaUrl));
  const appRoot = path.resolve(entryDir, '..');
  return path.resolve(appRoot, '..', '..');
};
