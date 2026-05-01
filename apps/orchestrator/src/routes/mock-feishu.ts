import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import type { ITaskStore } from '@agents/pipeline-core';
import { AppError } from '@agents/http-errors';
import {
  parseIntentFromMessage,
  ACTIONS_SKIP_CONCURRENCY_GUARD,
  actionLabelZh,
} from '../services/intent-concurrency.js';
import { assertNoConcurrentExclusiveTask } from '../services/assert-no-concurrent-task.js';
import { buildCustomerHelpFeishuReply } from '../services/customer-help-reply.js';

export type IMockFeishuRouteDeps = {
  logger: ILogger;
  taskStore: ITaskStore;
};

/**
 * 模拟飞书消息入口：解析意图 → 同动作并发门禁 → 建任务或返回可转发文案。
 * 生产接入飞书 Webhook 时复用 `assertNoConcurrentExclusiveTask` 与解析逻辑。
 */
export const registerMockFeishuRoutes = (
  app: Express,
  deps: IMockFeishuRouteDeps
): void => {
  const { logger, taskStore } = deps;

  app.post('/v1/mock-feishu', async (req, res, next) => {
    try {
      const body = req.body as {
        text?: string;
        message?: string;
        channelId?: string;
        metadata?: Record<string, unknown>;
      };
      const text = (body.text ?? body.message ?? '').trim();
      if (text === '') {
        throw new AppError('BAD_REQUEST', 'text or message required', 400);
      }

      const channelId =
        typeof body.channelId === 'string' && body.channelId !== ''
          ? body.channelId
          : undefined;

      const action = parseIntentFromMessage(text);
      if (action === null) {
        throw new AppError(
          'BAD_REQUEST',
          '无法从正文识别意图。可发「帮助」查看新手指引，或对照 docs/FEISHU_COMMANDS 发送',
          400
        );
      }

      logger.info('mock_feishu_intent', { action, channelId });

      if (action === 'status') {
        const tasks = await taskStore.listTasks({ limit: 30 });
        res.json({
          ok: true,
          action: 'status',
          tasks,
          feishuReplyText: formatStatusReply(tasks),
        });
        return;
      }

      if (action === 'help') {
        res.json({
          ok: true,
          action: 'help',
          feishuReplyText: buildCustomerHelpFeishuReply(),
        });
        return;
      }

      if (ACTIONS_SKIP_CONCURRENCY_GUARD.has(action)) {
        res.status(501).json({
          ok: false,
          code: 'NOT_IMPLEMENTED',
          action,
          message: `意图「${actionLabelZh(action)}」尚未在本 MVP 实现，请后续接编排逻辑`,
        });
        return;
      }

      const gate = await assertNoConcurrentExclusiveTask(taskStore, action, {
        channelId,
      });
      if (!gate.ok) {
        logger.warn('concurrent_task_rejected', {
          requestedAction: action,
          blockingTaskId: gate.existingTask.taskId,
        });
        res.status(409).json({
          ok: false,
          code: 'CONCURRENT_TASK',
          requestedAction: action,
          existingTask: gate.existingTask,
          feishuReplyText: gate.feishuReplyText,
        });
        return;
      }

      const task = await taskStore.createTask({
        action,
        message: text,
        metadata: {
          ...body.metadata,
          source: 'mock_feishu',
          ...(channelId !== undefined ? { channelId } : {}),
        },
      });

      logger.info('mock_feishu_task_created', { taskId: task.taskId, action });
      res.status(201).json({
        ok: true,
        task,
        feishuReplyText: `已受理【${actionLabelZh(action)}】，任务 ID：${task.taskId}`,
      });
    } catch (e) {
      next(e);
    }
  });
};

const formatStatusReply = (
  tasks: Awaited<ReturnType<ITaskStore['listTasks']>>
): string => {
  if (tasks.length === 0) {
    return '当前没有任务记录。';
  }
  const lines = tasks.slice(0, 15).map((t) => {
    const label = t.action ?? '-';
    const msg =
      t.message !== undefined && t.message.length > 80
        ? `${t.message.slice(0, 80)}…`
        : (t.message ?? '');
    return `- ${t.taskId} [${t.status}] ${label} ${msg}`;
  });
  return ['近期任务（最多 15 条）：', ...lines].join('\n');
};
