import path from 'node:path';
import type { IAgentsConfig, ITargetProjectEntry } from './schema.js';
import { resolveWorkspacePath } from './resolve-workspace-path.js';

export type IResolveFeishuTaskTargetResult =
  | {
      readonly kind: 'ok';
      /** 仅在多目标条目命中时回填 */
      readonly targetProjectId?: string;
      readonly workspacePathAbsolute: string;
    }
  | {
      readonly kind: 'ambiguous';
      readonly ids: readonly string[];
    }
  | { readonly kind: 'unknown_id'; readonly targetId: string };

/** 是否为「多目标」配置（至少两条 `target.projects`）。 */
export const isMultiTargetAgentsConfig = (config: IAgentsConfig): boolean =>
  (config.target?.projects?.length ?? 0) > 1;

export const normalizeTargetProjects = (
  config: IAgentsConfig
): readonly ITargetProjectEntry[] =>
  (config.target?.projects ?? []) as readonly ITargetProjectEntry[];

export const lookupTargetProjectById = (
  config: IAgentsConfig,
  targetId: string
): ITargetProjectEntry | undefined => {
  const t = targetId.trim();
  if (t === '') {
    return undefined;
  }
  return normalizeTargetProjects(config).find((p) => p.id === t);
};

/** 无前缀多目标条目时沿用 env / YAML / 默认值的工作区路径。 */
export const resolveLegacyTargetWorkspace = (
  monorepoRoot: string,
  env: NodeJS.ProcessEnv,
  yamlWorkspacePath?: string
): string => {
  const envWs = env.TARGET_WORKSPACE_PATH?.trim() ?? '';
  if (envWs !== '') {
    return resolveWorkspacePath(monorepoRoot, envWs);
  }
  const y = yamlWorkspacePath?.trim() ?? '';
  if (y !== '') {
    return path.isAbsolute(y) ? y : path.resolve(monorepoRoot, y);
  }
  return resolveWorkspacePath(monorepoRoot, undefined);
};

/**
 * 首行 `目标：<id>` / `本次目标：<id>` 时解析出 id，并返回剩余正文（用于编码/审核/测试说明）。
 * 仅当至少存在第二行时才解析，避免与单行消息误伤。
 */
export const extractLeadingTargetDirective = (
  text: string
): { readonly rest: string; readonly targetId?: string } => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return { rest: text };
  }
  const first = lines[0]?.trim() ?? '';
  const m =
    /^(?:目标|本次目标)[:：]\s*([a-zA-Z0-9][-a-zA-Z0-9_]*)\s*$/.exec(first);
  if (m === null || m[1] === undefined) {
    return { rest: text };
  }
  return {
    rest: lines.slice(1).join('\n').trimStart(),
    targetId: m[1],
  };
};

/** 形如「切换目标：app-a」「指令：绑定目标 app-b」。 */
export const parseSelectTargetMessage = (text: string): string | null => {
  const t = text.trim();
  const m =
    /^(?:指令[:：]\s*)?(?:切换目标|绑定目标|选择目标)[:：\s]+([a-zA-Z0-9][-a-zA-Z0-9_]*)\s*$/i.exec(
      t
    );
  return m?.[1] ?? null;
};

/**
 * 在飞书单次任务中选定的客户业务仓库根路径（绝对路径）。
 * `channelBoundTargetId` / `inlineTargetId` / env / YAML 默认 / 单子目自动兜底。
 */
export const resolveFeishuTaskWorkspace = (
  monorepoRoot: string,
  env: NodeJS.ProcessEnv,
  config: IAgentsConfig,
  input: {
    readonly channelBoundTargetId?: string;
    readonly inlineTargetId?: string;
  }
): IResolveFeishuTaskTargetResult => {
  const projects = normalizeTargetProjects(config);
  if (projects.length === 0) {
    return {
      kind: 'ok',
      workspacePathAbsolute: resolveLegacyTargetWorkspace(
        monorepoRoot,
        env,
        config.target?.workspacePath
      ),
    };
  }
  const index = new Map(projects.map((p) => [p.id, p]));
  const tryIdRaw =
    input.inlineTargetId?.trim() ||
    input.channelBoundTargetId?.trim() ||
    env.TARGET_DEFAULT_PROJECT_ID?.trim() ||
    config.target?.defaultProjectId?.trim() ||
    (projects.length === 1 ? projects[0]?.id : undefined);

  const tryId = tryIdRaw !== undefined && tryIdRaw !== '' ? tryIdRaw : undefined;
  if (tryId === undefined) {
    return { kind: 'ambiguous', ids: projects.map((p) => p.id) };
  }
  const entry = index.get(tryId);
  if (entry === undefined) {
    return { kind: 'unknown_id', targetId: tryId };
  }
  const abs = path.isAbsolute(entry.workspacePath)
    ? entry.workspacePath
    : path.resolve(monorepoRoot, entry.workspacePath);
  return {
    kind: 'ok',
    targetProjectId: entry.id,
    workspacePathAbsolute: abs,
  };
};
