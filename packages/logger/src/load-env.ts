import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load monorepo root `.env` when the entry file lives under `apps/<app>/src/*`.
 */
export const loadMonorepoEnvFromEntry = (importMetaUrl: string): void => {
  const entryDir = path.dirname(fileURLToPath(importMetaUrl));
  const appRoot = path.resolve(entryDir, '..');
  const monorepoRoot = path.resolve(appRoot, '..', '..');
  config({ path: path.join(monorepoRoot, '.env') });
  if (!process.env.AGENTS_MONOREPO_ROOT) {
    process.env.AGENTS_MONOREPO_ROOT = monorepoRoot;
  }
};
