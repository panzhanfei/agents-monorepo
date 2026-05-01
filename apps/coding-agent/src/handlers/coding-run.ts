import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import { resolveWorkspacePath } from '@agents/agents-config';
import { z } from 'zod';

const maxInstructionChars = 200_000;

const codingRunBodySchema = z.object({
  taskId: z.string().min(1),
  instruction: z.string().min(1).max(maxInstructionChars),
  workspacePath: z.string().optional(),
});

export const createCodingRunHandler = (
  logger: ILogger,
  monorepoRoot: string
): RequestHandler => {
  return (req, res, next) => {
    try {
      const parsed = codingRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new AppError('BAD_REQUEST', detail || 'Invalid body', 400);
      }
      const { taskId, instruction, workspacePath: workspacePathBody } =
        parsed.data;

      const workspace = resolveWorkspacePath(
        monorepoRoot,
        workspacePathBody !== undefined && workspacePathBody.trim() !== ''
          ? workspacePathBody.trim()
          : process.env.TARGET_WORKSPACE_PATH
      );
      logger.info('coding_run_accepted', {
        taskId,
        instructionLen: instruction.length,
        hasWorkspace: workspace !== '',
      });

      const clipped =
        instruction.length > 4000
          ? `${instruction.slice(0, 4000)}\n\n…（已截断）`
          : instruction;
      const summaryMarkdown = [
        '## 编码任务（MVP 占位）',
        '',
        `已收到任务 **${taskId}**。当前 **coding-agent** 不执行自动改代码，仅登记并回传摘要，便于飞书侧确认链路打通。`,
        '',
        workspace !== ''
          ? `绑定工作区：\`${workspace}\`（请在本地按说明开发或由后续版本接入自动修改）。`
          : '未配置 `TARGET_WORKSPACE_PATH` 且请求体未带 `workspacePath` 时，请在 `.env` 中设置或由编排器下发路径后再跑实际编码。',
        '',
        '### 需求/说明原文',
        '',
        clipped,
      ].join('\n');

      res.json({
        ok: true,
        taskId,
        accepted: true,
        summaryMarkdown,
        note: 'stub: replace with real coding pipeline when ready',
      });
    } catch (e) {
      next(e);
    }
  };
};
