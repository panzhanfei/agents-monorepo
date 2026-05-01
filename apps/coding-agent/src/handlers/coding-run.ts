import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';

const maxInstructionChars = 200_000;

export const createCodingRunHandler = (logger: ILogger): RequestHandler => {
  return (req, res, next) => {
    try {
      const body = req.body as { taskId?: unknown; instruction?: unknown };
      const taskId = typeof body.taskId === 'string' ? body.taskId : '';
      const instruction =
        typeof body.instruction === 'string' ? body.instruction : '';
      if (taskId === '' || instruction.trim() === '') {
        throw new AppError(
          'BAD_REQUEST',
          'taskId（非空字符串）与 instruction（非空字符串）必填',
          400
        );
      }
      if (instruction.length > maxInstructionChars) {
        throw new AppError(
          'BAD_REQUEST',
          `instruction 过长（>${String(maxInstructionChars)}）`,
          400
        );
      }

      const workspace = process.env.TARGET_WORKSPACE_PATH?.trim() ?? '';
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
          : '未配置 `TARGET_WORKSPACE_PATH` 时，请在 `.env` 中设置后再跑实际编码。',
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
