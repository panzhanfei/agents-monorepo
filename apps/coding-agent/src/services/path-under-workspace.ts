import fs from 'node:fs';
import path from 'node:path';

/**
 * 将相对路径限制在 `workspaceRoot` 内；拒绝 `..`、绝对路径、空段、NUL。
 * @returns 规范化的绝对路径，或不可用时为 null
 */
export const resolvePathUnderWorkspace = (
  workspaceRoot: string,
  relativeOrEmpty: string
): string | null => {
  const raw = relativeOrEmpty.trim().replace(/\\/g, '/');
  if (raw === '' || raw.includes('\0')) {
    return null;
  }
  if (path.isAbsolute(raw) || raw.startsWith('/')) {
    return null;
  }
  const segments = raw.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '..')) {
    return null;
  }
  const ws = path.resolve(workspaceRoot);
  const resolved = path.resolve(ws, ...segments);
  const rel = path.relative(ws, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
};

export const ensureParentDir = async (
  absoluteFilePath: string
): Promise<void> => {
  await fs.promises.mkdir(path.dirname(absoluteFilePath), { recursive: true });
};
