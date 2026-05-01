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
import { analyzeRequirementsHttp } from '../clients/requirements-agent-client.js';
import { runReviewHttp, runTestHttp } from '../clients/review-test-agents-client.js';

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

      if (action === 'requirements_analysis') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        try {
          const analysis = await analyzeRequirementsHttp({
            taskId: task.taskId,
            rawRequirement: text,
          });
          const updated = await taskStore.updateTask(task.taskId, {
            status: 'completed',
            metadata: {
              ...(task.metadata ?? {}),
              requirementsMarkdown: analysis.markdown,
              prdStatus: analysis.prdStatus,
            },
          });
          const preview =
            analysis.markdown.length > 2500
              ? `${analysis.markdown.slice(0, 2500)}\n\n…（已截断，完整 PRD 见任务 metadata.requirementsMarkdown）`
              : analysis.markdown;
          res.status(201).json({
            ok: true,
            task: updated,
            requirementsAnalysis: analysis,
            feishuReplyText: [
              `【需求分析】已完成（状态：${analysis.prdStatus}），任务 ID：${task.taskId}`,
              '',
              preview,
            ].join('\n'),
          });
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          await taskStore.updateTask(task.taskId, {
            status: 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              requirementsError: errMsg,
            },
          });
          throw new AppError(
            'REQUIREMENTS_AGENT_FAILED',
            `需求分析失败：${errMsg}`,
            502
          );
        }
      }

      if (action === 'review') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        try {
          const review = await runReviewHttp({
            taskId: task.taskId,
          });
          const summarySnippet =
            review.llm.summaryMarkdown.length > 1800
              ? `${review.llm.summaryMarkdown.slice(0, 1800)}…`
              : review.llm.summaryMarkdown;
          const updated = await taskStore.updateTask(task.taskId, {
            status: review.overallPassed ? 'completed' : 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              reviewProfileName: review.profileName,
              reviewOverallPassed: review.overallPassed,
              reviewBlockingGatePassed: review.blockingGate.passed,
              reviewLlmSkipped: review.llm.skipped,
              reviewSummarySnippet: summarySnippet,
            },
          });
          const gateLine = review.blockingGate.passed
            ? '确定性门禁：通过'
            : '确定性门禁：未通过';
          const llmLine = review.llm.skipped
            ? `语义评审：跳过（${review.llm.skipReason ?? 'unknown'}）`
            : `语义评审：blocking ${String(review.llm.blocking.length)} 条，warnings ${String(review.llm.warnings.length)} 条`;
          res.status(201).json({
            ok: true,
            task: updated,
            review,
            feishuReplyText: [
              `【代码审核】任务 ${task.taskId}`,
              `profile：${review.profileName}`,
              `overallPassed：${String(review.overallPassed)}`,
              gateLine,
              llmLine,
              '',
              summarySnippet === '' ? '（无摘要）' : summarySnippet,
            ].join('\n'),
          });
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          await taskStore.updateTask(task.taskId, {
            status: 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              reviewError: errMsg,
            },
          });
          throw new AppError(
            'REVIEW_AGENT_FAILED',
            `代码审核失败：${errMsg}`,
            502
          );
        }
      }

      if (action === 'test') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        try {
          const testResult = await runTestHttp({
            taskId: task.taskId,
          });
          const updated = await taskStore.updateTask(task.taskId, {
            status: testResult.passed ? 'completed' : 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              testPassed: testResult.passed,
              testExitCode: testResult.exitCode,
              testCommand: testResult.command,
              testDurationMs: testResult.durationMs,
            },
          });
          const outSnippet =
            testResult.stderrTail.length > 1200
              ? `${testResult.stderrTail.slice(0, 1200)}…`
              : testResult.stderrTail;
          res.status(201).json({
            ok: true,
            task: updated,
            test: testResult,
            feishuReplyText: [
              `【全量测试】任务 ${task.taskId}`,
              `passed：${String(testResult.passed)} exitCode：${String(testResult.exitCode)}`,
              `command：${testResult.command}`,
              `耗时：${String(testResult.durationMs)} ms`,
              '',
              outSnippet === '' ? '（stderr 为空）' : `stderr 节选：\n${outSnippet}`,
            ].join('\n'),
          });
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          await taskStore.updateTask(task.taskId, {
            status: 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              testError: errMsg,
            },
          });
          throw new AppError(
            'TEST_AGENT_FAILED',
            `全量测试失败：${errMsg}`,
            502
          );
        }
      }

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
