/** 与编排仓 `agents.config.yaml` · `targetProjectEntrySchema` 一致，用于前端即时校验 */

import { z } from 'zod';

export const projectEntryFormSchema = z
  .object({
    id: z
      .string()
      .min(1, '不能为空')
      .regex(
        /^[a-zA-Z0-9][-a-zA-Z0-9_]*$/,
        'id 须 ASCII 开头，仅字母·数字·-·_ '
      ),
    workspacePath: z.string().min(1, '工作区路径必填'),
    label: z.union([z.string(), z.literal('')]).optional(),
  })
  .strict();

export type IProjectEntryForm = z.infer<typeof projectEntryFormSchema>;
