import path from 'node:path';

export const resolveWorkspacePath = (
  monorepoRoot: string,
  workspacePathFromEnv?: string
): string => {
  const rawCandidate =
    workspacePathFromEnv !== undefined && workspacePathFromEnv.trim() !== ''
      ? workspacePathFromEnv.trim()
      : (process.env.TARGET_WORKSPACE_PATH ?? './workspace/target-repo').trim();
  return path.isAbsolute(rawCandidate)
    ? rawCandidate
    : path.resolve(monorepoRoot, rawCandidate);
};
