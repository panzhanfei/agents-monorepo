import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import type { ITaskStore } from '@agents/pipeline-core';
import { AppError } from '@agents/http-errors';
import { ACTIONS_SKIP_CONCURRENCY_GUARD } from '../services/intent-concurrency.js';
import { assertNoConcurrentExclusiveTask } from '../services/assert-no-concurrent-task.js';

export type ITasksRouteDeps = {
  logger: ILogger;
  taskStore: ITaskStore;
};

/**
 * 内部 REST：便于 MVP 调试与后续 Web UI；生产应对外鉴权或仅限内网。
 */
export const registerTaskRoutes = (app: Express, deps: ITasksRouteDeps): void => {
  const { logger, taskStore } = deps;

  app.get('/v1/tasks', async (_req, res, next) => {
    try {
      const list = await taskStore.listTasks({ limit: 50 });
      logger.info('tasks_list', { count: list.length });
      res.json({ ok: true, tasks: list });
    } catch (e) {
      next(e);
    }
  });

  app.get('/v1/tasks/:taskId', async (req, res, next) => {
    try {
      const { taskId } = req.params;
      if (taskId === undefined || taskId === '') {
        throw new AppError('BAD_REQUEST', 'taskId required', 400);
      }
      const task = await taskStore.getTask(taskId);
      if (task === null) {
        throw new AppError('NOT_FOUND', 'Task not found', 404);
      }
      res.json({ ok: true, task });
    } catch (e) {
      next(e);
    }
  });

  app.post('/v1/tasks', async (req, res, next) => {
    try {
      const body = req.body as {
        action?: string;
        message?: string;
        channelId?: string;
        metadata?: Record<string, unknown>;
      };
      const action = body.action;
      const channelId =
        typeof body.channelId === 'string' && body.channelId !== ''
          ? body.channelId
          : typeof body.metadata?.channelId === 'string'
            ? body.metadata.channelId
            : undefined;

      if (
        action !== undefined &&
        action !== '' &&
        !ACTIONS_SKIP_CONCURRENCY_GUARD.has(action)
      ) {
        const gate = await assertNoConcurrentExclusiveTask(taskStore, action, {
          channelId,
        });
        if (!gate.ok) {
          logger.warn('concurrent_task_rejected', {
            requestedAction: action,
            blockingTaskId: gate.existingTask.taskId,
            path: 'POST /v1/tasks',
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
      }

      const meta: Record<string, unknown> = { ...(body.metadata ?? {}) };
      if (channelId !== undefined && channelId !== '') {
        meta.channelId = channelId;
      }

      const task = await taskStore.createTask({
        action,
        message: body.message,
        metadata: Object.keys(meta).length > 0 ? meta : undefined,
      });
      logger.info('task_created', { taskId: task.taskId });
      res.status(201).json({ ok: true, task });
    } catch (e) {
      next(e);
    }
  });
};
