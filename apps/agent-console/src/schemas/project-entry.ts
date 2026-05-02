/** 与编排仓 `agents.config.yaml` · 合并后的 `target.projects` 条目一致（控制台表单） */

import { z } from 'zod';

const strOpt = z.string().optional();

export const projectEntryFormSchema = z
  .object({
    id: z
      .string()
      .min(1, '不能为空')
      .regex(
        /^[a-zA-Z0-9][-a-zA-Z0-9_]*$/,
        'id 须 ASCII 开头，仅字母·数字·-·_ ',
      ),
    workspacePath: z.string().min(1, '工作区路径必填'),
    label: strOpt,
    gitRepoUrl: strOpt,
    defaultBranch: strOpt,
    deployRemotePath: strOpt,
    deploySshHost: strOpt,
    deploySshUser: strOpt,
    deploySshPort: strOpt,
    probeListenPorts: strOpt,
    publishCommand: strOpt,
    fullTestCommand: strOpt,
    /** `greenfield`：编码自检可创建缺失的 `workspacePath` 目录。 */
    workspaceLifecycle: z.enum(['existing', 'greenfield']).optional(),
  })
  .strict();

export type IProjectEntryForm = z.infer<typeof projectEntryFormSchema>;
