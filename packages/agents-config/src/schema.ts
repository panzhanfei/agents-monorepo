import { z } from 'zod';

const reviewProfileSchema = z
  .object({
    aiRulesGlob: z.string(),
    customerRulesDir: z.string(),
    blockingCommands: z.array(z.string()),
  })
  .passthrough();

/** 具名目标项目（多目标模式）；与 `target.workspacePath` 单目标配置可并存，未列 `projects` 时行为与旧版一致。 */
export const targetProjectEntrySchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9][-a-zA-Z0-9_]*$/),
    workspacePath: z.string().min(1),
    label: z.string().optional(),
  })
  .strict();

export const agentsTargetSchema = z
  .object({
    source: z.enum(['git', 'local']).optional(),
    gitRepoUrl: z.string().optional(),
    defaultBranch: z.string().optional(),
    workspacePath: z.string().optional(),
    /** 多目标时可选默认 id；也可通过环境变量 `TARGET_DEFAULT_PROJECT_ID` 或飞书「切换目标」绑定。 */
    defaultProjectId: z.string().optional(),
    projects: z.array(targetProjectEntrySchema).optional(),
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

export type IAgentsConfig = z.infer<typeof agentsConfigSchema>;
export type ITargetProjectEntry = z.infer<typeof targetProjectEntrySchema>;
