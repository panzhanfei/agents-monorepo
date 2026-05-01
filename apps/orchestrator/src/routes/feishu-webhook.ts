import type { Express, Request, Response, NextFunction } from 'express';
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
import { runCodingHttp } from '../clients/coding-agent-client.js';
import { extractFeishuInboundText } from '../services/extract-feishu-inbound.js';
import { extractFeishuUrlVerificationChallenge } from '../services/feishu-url-verification.js';
import {
  feishuAutoReplyConfigured,
  sendFeishuOutboundText,
} from '../services/feishu-im-reply.js';
import { teeFeishuFlow } from '../services/tee-feishu-flow.js';

const previewText = (t: string, max = 120): string =>
  t.length <= max ? t : `${t.slice(0, max)}…`;

export type IFeishuWebhookRouteDeps = {
  logger: ILogger;
  taskStore: ITaskStore;
};

/**
 * 飞书 Webhook（及同源 HTTP 触发）：解析消息意图 → 同动作并发门禁 → 建任务并编排下游或返回可转发文案。
 * 真飞书「加密事件」需另行实现解密；URL 校验见 `extractFeishuUrlVerificationChallenge`。
 */
export const registerFeishuWebhookRoutes = (
  app: Express,
  deps: IFeishuWebhookRouteDeps
): void => {
  const { logger, taskStore } = deps;

  const feishuWebhookPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const rootEarly =
      req.body !== null &&
      typeof req.body === 'object' &&
      !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    logger.info('飞书 webhook 入口', {
      flow: 'webhook_in',
      path: req.path,
      method: req.method,
      contentLength: req.headers['content-length'],
      bodyKeys: Object.keys(rootEarly).slice(0, 24),
      hasEncrypt: typeof rootEarly.encrypt === 'string',
      hasEvent: rootEarly.event !== undefined,
    });
    const keySummary =
      Object.keys(rootEarly).length === 0
        ? '(empty body)'
        : Object.keys(rootEarly)
            .slice(0, 10)
            .join(',') + (Object.keys(rootEarly).length > 10 ? '…' : '');
    teeFeishuFlow('>>> ① 请求进入', `${req.method} ${req.path} | ${keySummary}`);

    try {
      const urlChallenge = extractFeishuUrlVerificationChallenge(req.body);
      if (urlChallenge !== null) {
        logger.info('飞书 URL 验证', { flow: 'url_verification' });
        res.status(200).json({ challenge: urlChallenge });
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          kind: 'url_verification',
        });
        teeFeishuFlow('>>> ⑦ 响应', '200 URL 校验(challenge)');
        return;
      }

      const rootBody =
        req.body !== null &&
        typeof req.body === 'object' &&
        !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};

      const extracted = extractFeishuInboundText(req.body);
      const looksEncryptPost =
        typeof rootBody.encrypt === 'string' && rootBody.encrypt.length > 0;
      if (extracted === null || extracted.text.trim() === '') {
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          kind: 'no_text',
          looksEncryptPost,
        });
        res.status(200).json({
          ok: false,
          code: 'NO_TEXT',
          feishuReplyText: looksEncryptPost
            ? '收到了飞书加密事件，本机尚未解密。请在开放平台关闭加密或接入官方解密/SDK，把明文事件 POST 给编排器；也可联系部署方开启明文订阅用于联调。'
            : '未识别到可处理的文字。若飞书事件为加密投递，需在服务端先解密再转给本接口；也可直接发「帮助」查看指令说明。',
        });
        teeFeishuFlow(
          '>>> ⑦ 响应',
          looksEncryptPost ? '200 无正文(可能需解密)' : '200 无正文'
        );
        return;
      }

      const text = extracted.text;
      const channelId =
        extracted.channelId !== undefined && extracted.channelId !== ''
          ? extracted.channelId
          : typeof rootBody.channelId === 'string' && rootBody.channelId !== ''
            ? rootBody.channelId
            : undefined;

      const inboundMessageId =
        extracted.inboundMessageId !== undefined &&
        extracted.inboundMessageId !== ''
          ? extracted.inboundMessageId
          : undefined;

      const rootMeta =
        rootBody.metadata !== null &&
        typeof rootBody.metadata === 'object' &&
        !Array.isArray(rootBody.metadata)
          ? (rootBody.metadata as Record<string, unknown>)
          : {};

      const respondFeishuJson = (
        statusCode: number,
        body: Record<string, unknown>
      ): void => {
        const reply =
          typeof body.feishuReplyText === 'string' &&
          body.feishuReplyText.length > 0
            ? body.feishuReplyText
            : undefined;
        res.status(statusCode).json(body);
        if (
          reply !== undefined &&
          (channelId !== undefined || inboundMessageId !== undefined)
        ) {
          void sendFeishuOutboundText({
            chatId: channelId,
            inboundMessageId,
            text: reply,
            logger,
          })
            .then((sendResult) => {
              if (sendResult.kind === 'error') {
                logger.warn('feishu_im_reply_failed', {
                  message: sendResult.message,
                });
                teeFeishuFlow(
                  '>>> ⑥ 飞书会话',
                  `发消息失败：${sendResult.message.slice(0, 120)}`
                );
              } else if (sendResult.kind === 'ok') {
                teeFeishuFlow('>>> ⑥ 飞书会话', '已发群消息');
              } else if (feishuAutoReplyConfigured()) {
                teeFeishuFlow(
                  '>>> ⑥ 飞书会话',
                  '已跳过发消息（FEISHU_AUTO_REPLY=0 或 false）'
                );
              } else {
                teeFeishuFlow(
                  '>>> ⑥ 飞书会话',
                  '已跳过发消息（未配置 FEISHU_APP_ID / FEISHU_APP_SECRET）'
                );
                logger.info('feishu_im_reply_skipped', {
                  reason: 'no_feishu_app_credentials',
                });
              }
            })
            .catch((e: unknown) => {
              const msg = e instanceof Error ? e.message : String(e);
              logger.error('feishu_im_reply_unexpected', { message: msg });
              teeFeishuFlow(
                '>>> ⑥ 飞书会话',
                `发消息异常：${msg.slice(0, 120)}`
              );
            });
        } else if (
          reply !== undefined &&
          channelId === undefined &&
          inboundMessageId === undefined
        ) {
          logger.info('feishu_im_reply_skipped', {
            reason: 'no_chat_id_no_inbound_message_id',
          });
        }
      };

      logger.info('收到消息', {
        flow: 'receive',
        channelId: channelId ?? null,
        inboundMessageId: inboundMessageId ?? null,
        textLen: text.length,
        textPreview: previewText(text),
      });
      teeFeishuFlow('>>> ② 正文', previewText(text));

      const action = parseIntentFromMessage(text);
      if (action === null) {
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          kind: 'unknown_intent',
        });
        respondFeishuJson(200, {
          ok: false,
          code: 'UNKNOWN_INTENT',
          feishuReplyText: [
            '这句话里没有识别到指令。',
            '',
            '发「帮助」可查看完整命令说明。常用示例：',
            '· 需求分析：〈你的产品需求〉',
            '· 编码：〈要做的改动〉',
            '· 状态',
          ].join('\n'),
        });
        teeFeishuFlow('>>> ⑦ 响应', '200 未识别意图');
        return;
      }

      logger.info('解析意图', {
        flow: 'intent',
        action,
        channelId: channelId ?? null,
      });
      teeFeishuFlow('>>> ③ 意图', action);

      if (action === 'status') {
        const tasks = await taskStore.listTasks({ limit: 30 });
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          action: 'status',
          taskCount: tasks.length,
        });
        respondFeishuJson(200, {
          ok: true,
          action: 'status',
          tasks,
          feishuReplyText: formatStatusReply(tasks),
        });
        teeFeishuFlow('>>> ⑦ 响应', `200 status 共${String(tasks.length)}条`);
        return;
      }

      if (action === 'help') {
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          action: 'help',
        });
        respondFeishuJson(200, {
          ok: true,
          action: 'help',
          feishuReplyText: buildCustomerHelpFeishuReply(),
        });
        teeFeishuFlow('>>> ⑦ 响应', '200 help');
        return;
      }

      if (ACTIONS_SKIP_CONCURRENCY_GUARD.has(action)) {
        const reply = `「${actionLabelZh(action)}」尚未接入，请发「帮助」查看当前已支持的指令。`;
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 501,
          action,
          reason: 'not_implemented',
        });
        respondFeishuJson(501, {
          ok: false,
          code: 'NOT_IMPLEMENTED',
          action,
          message: `意图「${actionLabelZh(action)}」尚未在本 MVP 实现，请后续接编排逻辑`,
          feishuReplyText: reply,
        });
        teeFeishuFlow('>>> ⑦ 响应', `501 未实现 ${action}`);
        return;
      }

      const gate = await assertNoConcurrentExclusiveTask(taskStore, action, {
        channelId,
      });
      if (!gate.ok) {
        logger.warn('并发门禁：已拒绝', {
          flow: 'respond',
          httpStatus: 409,
          requestedAction: action,
          blockingTaskId: gate.existingTask.taskId,
        });
        respondFeishuJson(409, {
          ok: false,
          code: 'CONCURRENT_TASK',
          requestedAction: action,
          existingTask: gate.existingTask,
          feishuReplyText: gate.feishuReplyText,
        });
        teeFeishuFlow('>>> ⑦ 响应', '409 并发拦截');
        return;
      }

      const task = await taskStore.createTask({
        action,
        message: text,
        metadata: {
          ...rootMeta,
          source: 'feishu_webhook',
          ...(channelId !== undefined ? { channelId } : {}),
        },
      });

      logger.info('任务已创建', {
        flow: 'task',
        taskId: task.taskId,
        action,
      });
      teeFeishuFlow('>>> ④ 任务已创建', `${task.taskId} | ${action}`);

      if (action === 'requirements_analysis') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        logger.info('执行步骤', {
          flow: 'execute',
          taskId: task.taskId,
          step: 'requirements_agent',
          stage: 'start',
        });
        teeFeishuFlow('>>> ⑤ 执行中', '需求分析 → requirements-agent');
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
          if (updated === null) {
            throw new AppError('INTERNAL', '更新任务失败（requirements）', 500);
          }
          logger.info('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'requirements_agent',
            stage: 'done',
            taskStatus: 'completed',
            prdStatus: analysis.prdStatus,
          });
          const preview =
            analysis.markdown.length > 2500
              ? `${analysis.markdown.slice(0, 2500)}\n\n…（已截断，完整 PRD 见任务 metadata.requirementsMarkdown）`
              : analysis.markdown;
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 201,
            taskId: task.taskId,
            action: 'requirements_analysis',
            outcome: 'completed',
          });
          respondFeishuJson(201, {
            ok: true,
            task: updated,
            requirementsAnalysis: analysis,
            feishuReplyText: [
              `【需求分析】已完成（状态：${analysis.prdStatus}），任务 ID：${task.taskId}`,
              '',
              preview,
            ].join('\n'),
          });
          teeFeishuFlow(
            '>>> ⑦ 响应',
            `201 需求分析完成 | ${analysis.prdStatus} | ${task.taskId}`
          );
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          teeFeishuFlow('>>> ✖ 失败', `需求分析 ${errMsg.slice(0, 120)}`);
          logger.warn('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'requirements_agent',
            stage: 'failed',
            error: errMsg,
          });
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

      if (action === 'code') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        logger.info('执行步骤', {
          flow: 'execute',
          taskId: task.taskId,
          step: 'coding_agent',
          stage: 'start',
        });
        teeFeishuFlow('>>> ⑤ 执行中', '编码 → coding-agent');
        try {
          const codingResult = await runCodingHttp({
            taskId: task.taskId,
            instruction: text,
          });
          const updated = await taskStore.updateTask(task.taskId, {
            status: 'completed',
            metadata: {
              ...(task.metadata ?? {}),
              codingSummarySnippet:
                codingResult.summaryMarkdown.length > 2000
                  ? `${codingResult.summaryMarkdown.slice(0, 2000)}…`
                  : codingResult.summaryMarkdown,
              ...(codingResult.note !== undefined
                ? { codingNote: codingResult.note }
                : {}),
            },
          });
          if (updated === null) {
            throw new AppError('INTERNAL', '更新任务失败（code）', 500);
          }
          logger.info('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'coding_agent',
            stage: 'done',
            taskStatus: 'completed',
          });
          const snippet =
            codingResult.summaryMarkdown.length > 2200
              ? `${codingResult.summaryMarkdown.slice(0, 2200)}\n\n…`
              : codingResult.summaryMarkdown;
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 201,
            taskId: task.taskId,
            action: 'code',
            outcome: 'completed',
          });
          respondFeishuJson(201, {
            ok: true,
            task: updated,
            coding: codingResult,
            feishuReplyText: ['【编码】任务 ' + task.taskId + '（MVP 占位）', '', snippet].join(
              '\n'
            ),
          });
          teeFeishuFlow('>>> ⑦ 响应', `201 编码完成 | ${task.taskId}`);
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          teeFeishuFlow('>>> ✖ 失败', `编码 ${errMsg.slice(0, 120)}`);
          logger.warn('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'coding_agent',
            stage: 'failed',
            error: errMsg,
          });
          await taskStore.updateTask(task.taskId, {
            status: 'failed',
            metadata: {
              ...(task.metadata ?? {}),
              codingError: errMsg,
            },
          });
          throw new AppError(
            'CODING_AGENT_FAILED',
            `编码任务失败：${errMsg}`,
            502
          );
        }
      }

      if (action === 'review') {
        await taskStore.updateTask(task.taskId, { status: 'running' });
        logger.info('执行步骤', {
          flow: 'execute',
          taskId: task.taskId,
          step: 'review_agent',
          stage: 'start',
        });
        teeFeishuFlow('>>> ⑤ 执行中', '审核 → review-agent');
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
          if (updated === null) {
            throw new AppError('INTERNAL', '更新任务失败（review）', 500);
          }
          const gateLine = review.blockingGate.passed
            ? '确定性门禁：通过'
            : '确定性门禁：未通过';
          const llmLine = review.llm.skipped
            ? `语义评审：跳过（${review.llm.skipReason ?? 'unknown'}）`
            : `语义评审：blocking ${String(review.llm.blocking.length)} 条，warnings ${String(review.llm.warnings.length)} 条`;
          logger.info('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'review_agent',
            stage: 'done',
            taskStatus: updated.status,
            overallPassed: review.overallPassed,
          });
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 201,
            taskId: task.taskId,
            action: 'review',
            outcome: updated.status,
          });
          respondFeishuJson(201, {
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
          teeFeishuFlow(
            '>>> ⑦ 响应',
            `201 审核结束 | ${updated.status} | ${task.taskId}`
          );
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          teeFeishuFlow('>>> ✖ 失败', `审核 ${errMsg.slice(0, 120)}`);
          logger.warn('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'review_agent',
            stage: 'failed',
            error: errMsg,
          });
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
        logger.info('执行步骤', {
          flow: 'execute',
          taskId: task.taskId,
          step: 'test_agent',
          stage: 'start',
        });
        teeFeishuFlow('>>> ⑤ 执行中', '测试 → test-agent');
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
          if (updated === null) {
            throw new AppError('INTERNAL', '更新任务失败（test）', 500);
          }
          const outSnippet =
            testResult.stderrTail.length > 1200
              ? `${testResult.stderrTail.slice(0, 1200)}…`
              : testResult.stderrTail;
          logger.info('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'test_agent',
            stage: 'done',
            taskStatus: updated.status,
            passed: testResult.passed,
            exitCode: testResult.exitCode,
          });
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 201,
            taskId: task.taskId,
            action: 'test',
            outcome: updated.status,
          });
          respondFeishuJson(201, {
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
          teeFeishuFlow(
            '>>> ⑦ 响应',
            `201 测试结束 | ${updated.status} | ${task.taskId}`
          );
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          teeFeishuFlow('>>> ✖ 失败', `测试 ${errMsg.slice(0, 120)}`);
          logger.warn('执行步骤', {
            flow: 'execute',
            taskId: task.taskId,
            step: 'test_agent',
            stage: 'failed',
            error: errMsg,
          });
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

      logger.info('返回响应', {
        flow: 'respond',
        httpStatus: 201,
        taskId: task.taskId,
        action,
        outcome: 'accepted_only',
      });
      respondFeishuJson(201, {
        ok: true,
        task,
        feishuReplyText: `已受理【${actionLabelZh(action)}】，任务 ID：${task.taskId}`,
      });
      teeFeishuFlow('>>> ⑦ 响应', `201 已受理 | ${action} | ${task.taskId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      teeFeishuFlow('>>> ✖ 未捕获', msg.slice(0, 160));
      next(e);
    }
  };

  app.post('/v1/feishu/webhook', feishuWebhookPost);
  /** 简短路径，便于飞书开放平台「请求地址」配置为 `…/feishu/webhook`。 */
  app.post('/feishu/webhook', feishuWebhookPost);
  /**
   * 兼容旧「请求地址」（曾写 `/v1/mock-feishu`）；否则会 404，飞书报「Challenge code 没有返回」。
   * 新集成请用 `/v1/feishu/webhook`。
   */
  app.post('/v1/mock-feishu', feishuWebhookPost);
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
