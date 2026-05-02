import { z } from 'zod';

import { TARGET_PROJECT_ID_RE } from './target-project-id-re.js';

const reviewProfileSchema = z
  .object({
    aiRulesGlob: z.string(),
    customerRulesDir: z.string(),
    blockingCommands: z.array(z.string()),
  })
  .passthrough();

export { TARGET_PROJECT_ID_RE };

const targetIdRegex = TARGET_PROJECT_ID_RE;

/** 编排仓根下「目标项目模块」树：`customer-targets/<id>/target.yaml`。 */
export const CUSTOMER_TARGETS_ROOT_REL = 'customer-targets' as const;

/** 保留分段名：`customer-targets/_shared/` 为未来通用资源预留，不能用作 `target.projects` 的 id。 */
export const CUSTOMER_TARGETS_SHARED_SEGMENT = '_shared' as const;

export const CUSTOMER_TARGETS_TARGET_DEFINITION_BASENAME =
  'target.yaml' as const;

/**
 * 每条 `customer-targets/<id>/` 下可选目录：与本编排仓同库维护的审核规则（如 `*.mdc`），
 * review-agent 在解析到对应目标 id 时自动并入规则包（无须写进客户工作区）。
 */
export const CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT = 'ai-rules' as const;

/** @deprecated 新写入请使用 {@link CUSTOMER_TARGETS_ROOT_REL} 树；仍可读取旧路径。 */
export const DEFAULT_TARGET_PROJECT_DEFINITION_SUBPATH =
  '.agents/target-projects' as const;

/** 新项目：允许的 `workspacePath` 尚未存在，自检阶段会递归创建目录。 */
export const workspaceLifecycleSchema = z.enum(['existing', 'greenfield']);

export type IWorkspaceLifecycle = z.infer<typeof workspaceLifecycleSchema>;

const targetProjectOptionalStringsShape = {
  label: z.string().optional(),
  gitRepoUrl: z.string().optional(),
  defaultBranch: z.string().optional(),
  packBuildOutputDir: z.string().optional(),
  deployRemotePath: z.string().optional(),
  deploySshHost: z.string().optional(),
  deploySshUser: z.string().optional(),
  deploySshPort: z.string().optional(),
  probeListenPorts: z.string().optional(),
  publishCommand: z.string().optional(),
  fullTestCommand: z.string().optional(),
  workspaceLifecycle: workspaceLifecycleSchema.optional(),
};

/**
 * 磁盘上单文件定义（如 `customer-targets/<id>/target.yaml`，或遗留 `.agents/target-projects/<id>.yaml`）。
 * `id` 可选；若填写须与主配置该条目的 `id` 一致。
 */
export const targetProjectDefinitionFileSchema = z
  .object({
    id: z.string().min(1).regex(targetIdRegex).optional(),
    workspacePath: z.string().min(1),
    ...targetProjectOptionalStringsShape,
  })
  .strip();

/**
 * agents.config.yaml 中每条 `target.projects`：
 * - 可整段内联；
 * - 或通过 `definitionPath` 指向单文件定义（非空内联字段覆盖文件中的同名字段）。
 */
export const targetProjectYamlRowSchema = z
  .object({
    id: z.string().min(1).regex(targetIdRegex),
    definitionPath: z.string().min(1).optional(),
    workspacePath: z.string().optional(),
    ...targetProjectOptionalStringsShape,
  })
  .strip()
  .superRefine((row, ctx) => {
    const def = row.definitionPath?.trim() ?? '';
    const ws = row.workspacePath?.trim() ?? '';
    if (def === '' && ws === '') {
      ctx.addIssue({
        code: 'custom',
        message:
          '每条 target.projects 须设置 workspacePath（内联）或 definitionPath（指向目标定义 YAML）',
        path: ['workspacePath'],
      });
    }
  });

/** 运行时合并后的目标条目（加载完成后不含 definitionPath） */
export const targetProjectEntrySchema = z
  .object({
    id: z.string().min(1).regex(targetIdRegex),
    workspacePath: z.string().min(1),
    ...targetProjectOptionalStringsShape,
  })
  .strict();

export type ITargetProjectYamlRow = z.infer<typeof targetProjectYamlRowSchema>;
export type ITargetProjectEntry = z.infer<typeof targetProjectEntrySchema>;

export const agentsTargetSchema = z
  .object({
    gitRepoUrl: z.string().optional(),
    defaultBranch: z.string().optional(),
    workspacePath: z.string().optional(),
    /** 多目标时可选默认 id；也可通过环境变量 `TARGET_DEFAULT_PROJECT_ID` 或飞书「切换目标」绑定。 */
    defaultProjectId: z.string().optional(),
    projects: z.array(targetProjectYamlRowSchema).optional(),
  })
  .passthrough();

export const agentsConfigSchema = z
  .object({
    pipeline: z
      .object({
        fullTestCommand: z.string(),
      })
      .passthrough(),
    review: z
      .object({
        activeProfile: z.string(),
        profiles: z.record(z.string(), reviewProfileSchema),
        extraConfigFiles: z.array(z.string()).optional(),
      })
      .passthrough(),
    target: agentsTargetSchema.optional(),
  })
  .passthrough();

export type IAgentsConfigParsed = z.infer<typeof agentsConfigSchema>;
export type IAgentsConfig = IAgentsConfigParsed;
