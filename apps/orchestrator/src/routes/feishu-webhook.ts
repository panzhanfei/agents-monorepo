import type { Express, Request, Response, NextFunction } from 'express';
import type { ILogger } from '@agents/logger';
import type { ITaskStore, IRequirementsAnalysisResponse } from '@agents/pipeline-core';
import path from 'node:path';
import { AppError } from '@agents/http-errors';
import {
  extractLeadingTargetDirective,
  isMultiTargetAgentsConfig,
  loadAgentsConfig,
  normalizeTargetProjects,
  parseSelectTargetMessage,
  resolveFeishuTaskWorkspace,
} from '@agents/agents-config';
import {
  parseIntentFromMessage,
  ACTIONS_SKIP_CONCURRENCY_GUARD,
  actionLabelZh,
} from '../services/intent-concurrency.js';
import { assertNoConcurrentExclusiveTask } from '../services/assert-no-concurrent-task.js';
import { buildCustomerHelpFeishuReply } from '../services/customer-help-reply.js';
import {
  buildCodingPrereqBlockedFeishuReply,
  collectCodingFeishuPrereqIssues,
} from '../services/feishu-action-prereqs.js';
import { parseRequirementsAnalysisMessage } from '../services/parse-requirements-revision.js';
import { analyzeRequirementsHttp } from '../clients/requirements-agent-client.js';
import { runReviewHttp, runTestHttp } from '../clients/review-test-agents-client.js';
import { runCodingHttp } from '../clients/coding-agent-client.js';
import { extractFeishuInboundText } from '../services/extract-feishu-inbound.js';
import { extractFeishuUrlVerificationChallenge } from '../services/feishu-url-verification.js';
import {
  feishuAutoReplyConfigured,
  sendFeishuOutboundText,
  type IFeishuSendResult,
} from '../services/feishu-im-reply.js';
import {
  clearFeishuPrdAnchors,
  registerFeishuPrdOutboundAnchor,
  resolveTaskIdFromQuotedFeishuMessage,
} from '../services/feishu-prd-thread-anchor.js';
import { stripOptionalRequirementsPrefix } from '../services/strip-requirements-lead.js';
import {
  buildFeishuDedupKey,
  tryBeginFeishuInboundDedup,
  finishFeishuInboundDedup,
} from '../services/feishu-inbound-dedup.js';
import { teeFeishuFlow } from '../services/tee-feishu-flow.js';
import {
  buildAmbiguousTargetFeishuReply,
  buildConfiguredTargetsBulletLines,
} from '../services/feishu-multi-target-replies.js';
import {
  getFeishuChannelBoundTargetId,
  setFeishuChannelBoundTargetId,
} from '../services/feishu-channel-target.js';
import { getOrchestratorMonorepoRoot } from '../config/monorepo-root.js';

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

      let workspaceResolution:
        | {
            workspacePathAbsolute: string;
            targetProjectId?: string;
          }
        | undefined;
      let instructionBodyForWorkspaceActions = text;
      const quotedThreadTaskId = resolveTaskIdFromQuotedFeishuMessage({
        parentMessageId: extracted.parentMessageId,
        rootMessageId: extracted.rootMessageId,
      });

      const rootMeta =
        rootBody.metadata !== null &&
        typeof rootBody.metadata === 'object' &&
        !Array.isArray(rootBody.metadata)
          ? (rootBody.metadata as Record<string, unknown>)
          : {};

      const respondFeishuJson = (
        statusCode: number,
        body: Record<string, unknown>,
        opts?: {
          readonly onOutboundSettled?: (
            sendResult: IFeishuSendResult
          ) => void | Promise<void>;
        }
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
            .then(async (sendResult) => {
              await opts?.onOutboundSettled?.(sendResult);
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

      const inboundDedupKey = buildFeishuDedupKey(rootBody, extracted);
      if (
        inboundDedupKey !== null &&
        !tryBeginFeishuInboundDedup(inboundDedupKey)
      ) {
        logger.info('飞书 webhook 去重：跳过重复投递', {
          flow: 'dedup',
          dedupKey: inboundDedupKey,
          inboundMessageId: inboundMessageId ?? null,
        });
        teeFeishuFlow('>>> ⑦ 响应', '200 重复投递(已忽略)');
        res.status(200).json({
          ok: true,
          code: 'DUPLICATE_INBOUND',
          message:
            '本条消息已处理过，重复投递已忽略（不会产生第二条机器人回复）。',
        });
        return;
      }

      const runInbound = async (): Promise<void> => {
      logger.info('收到消息', {
        flow: 'receive',
        channelId: channelId ?? null,
        inboundMessageId: inboundMessageId ?? null,
        quotableThreadTaskIdSuffix:
          quotedThreadTaskId !== undefined
            ? quotedThreadTaskId.slice(-8)
            : null,
        textLen: text.length,
        textPreview: previewText(text),
      });
      teeFeishuFlow('>>> ② 正文', previewText(text));

      let action = parseIntentFromMessage(text);
      if (
        quotedThreadTaskId !== undefined &&
        action === null &&
        text.trim() !== ''
      ) {
        action = 'requirements_analysis';
      }
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
            '发「帮助」可看完整说明。常用写法示例：',
            '需求分析：〈你的产品需求〉',
            '编码：〈要做的改动〉',
            '状态｜清空任务',
            '',
            '若在机器人 PRD 下「引用回复」，可直接写补充（不必再写任务 ID）；需本机 FEISHU_AUTO_REPLY 已把 PRD 发出并登记锚点。',
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

      if (action === 'clear_tasks') {
        clearFeishuPrdAnchors();
        const deleted = await taskStore.clearAllTasks();
        const reply =
          deleted === 0
            ? [
                '当前没有可清空的任务记录（内存任务表本来就是空的）。',
                '',
                '说明：每次「需求分析：…」都是只读你这一条消息起稿，不会在模型里自动接上旧任务；若 PRD 提到 Turborepo / 微前端等，多半是照抄你本条里的简历正文。',
                '若你看到两条一模一样的机器人回复：真实飞书事件含 message_id 时编排器会进程内去重；仍重复时请查双通道转发、多实例或未带 message_id 的本地模拟。',
              ].join('\n')
            : [
                `已清空本机内存中的 ${String(deleted)} 条任务记录（再看「状态」应为空）。`,
                '',
                '之后「需求分析：…」会分配新的任务 ID。',
                '注意：不要使用已清空任务里的 UUID 再做「修订」；修订只对你仍保留的任务 ID 有效。',
                '',
                '同上：新发起的「需求分析」不会自动混入旧 PRD；仍出现重复回复时参见上条（message_id 去重 / 双通道 / 多实例）。',
              ].join('\n');
        logger.info('返回响应', {
          flow: 'respond',
          httpStatus: 200,
          action: 'clear_tasks',
          deletedCount: deleted,
        });
        respondFeishuJson(200, {
          ok: true,
          action: 'clear_tasks',
          deletedCount: deleted,
          feishuReplyText: reply,
        });
        teeFeishuFlow('>>> ⑦ 响应', `200 clear_tasks 删${String(deleted)}`);
        return;
      }

      if (action === 'list_targets') {
        const monorepoRoot = getOrchestratorMonorepoRoot();
        const cfg = await loadAgentsConfig({ monorepoRoot }, process.env);
        const ps = normalizeTargetProjects(cfg);
        if (ps.length === 0) {
          respondFeishuJson(200, {
            ok: true,
            action: 'list_targets',
            feishuReplyText: [
              '当前为单目标模式：未配置 `agents.config.yaml` 的 `target.projects`。',
              '工作区由 `TARGET_WORKSPACE_PATH` 与可选的 `target.workspacePath` 解析，见 `.env.example`。',
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 target 列表 单目标');
          return;
        }
        respondFeishuJson(200, {
          ok: true,
          action: 'list_targets',
          feishuReplyText: [
            '已配置目标项目：',
            buildConfiguredTargetsBulletLines(ps),
            '',
            ...(isMultiTargetAgentsConfig(cfg)
              ? [
                  '多仓库时请先「切换目标：<id>」或在消息首行写「目标：<id>」（第二行起写编码/审核/测试）。',
                ]
              : ['当前仅此一条目录映射，会话内会自动使用该目录。']),
          ].join('\n'),
        });
        teeFeishuFlow('>>> ⑦ 响应', `200 target 列表 ${String(ps.length)}`);
        return;
      }

      if (action === 'select_target') {
        const selIdRaw = parseSelectTargetMessage(text);
        if (selIdRaw === null) {
          respondFeishuJson(200, {
            ok: false,
            code: 'SELECT_TARGET_PARSE_ERROR',
            feishuReplyText:
              '无法解析目标 id。请发送：`切换目标：<id>`（id 见「目标列表」）。',
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 切换目标解析失败');
          return;
        }
        const selId = selIdRaw.trim();
        const monorepoRoot = getOrchestratorMonorepoRoot();
        const cfg = await loadAgentsConfig({ monorepoRoot }, process.env);
        const ps = normalizeTargetProjects(cfg);
        if (ps.length === 0) {
          respondFeishuJson(200, {
            ok: false,
            code: 'TARGET_PROJECTS_NOT_CONFIGURED',
            feishuReplyText:
              '未配置 `target.projects`，无需切换。请用单一 `TARGET_WORKSPACE_PATH`。见 `.env.example`。',
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 未启用多目标');
          return;
        }
        const index = new Map(ps.map((p) => [p.id, p]));
        const hit = index.get(selId);
        if (hit === undefined) {
          respondFeishuJson(200, {
            ok: false,
            code: 'TARGET_PROJECT_UNKNOWN',
            feishuReplyText: [
              `未找到目标 id：「${selId}」。`,
              '',
              '已配置：',
              buildConfiguredTargetsBulletLines(ps),
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 切换目标 id 无效');
          return;
        }
        setFeishuChannelBoundTargetId(channelId, selId);
        const abs = path.isAbsolute(hit.workspacePath)
          ? hit.workspacePath
          : path.resolve(monorepoRoot, hit.workspacePath);
        respondFeishuJson(200, {
          ok: true,
          action: 'select_target',
          feishuReplyText: [
            `已绑定会话目标：**${hit.id}**`,
            '',
            `\`${abs}\``,
            '',
            '后续的「编码 / 审核 / 全量测试」默认在此目录执行（本条可多行并以首行「目标：<id>」临时覆盖）。',
          ].join('\n'),
        });
        teeFeishuFlow('>>> ⑦ 响应', `200 切换目标 ${hit.id}`);
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

      const needsTargetResolution =
        action === 'code' || action === 'review' || action === 'test';

      if (needsTargetResolution) {
        const monorepoRoot = getOrchestratorMonorepoRoot();
        const extractedLead = extractLeadingTargetDirective(text);
        instructionBodyForWorkspaceActions = extractedLead.rest;
        const agentsCfg = await loadAgentsConfig(
          { monorepoRoot },
          process.env
        );
        const pick = resolveFeishuTaskWorkspace(
          monorepoRoot,
          process.env,
          agentsCfg,
          {
            channelBoundTargetId: getFeishuChannelBoundTargetId(channelId),
            inlineTargetId: extractedLead.targetId,
          }
        );
        if (pick.kind === 'ambiguous') {
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 200,
            kind: 'target_projects_ambiguous',
          });
          respondFeishuJson(200, {
            ok: false,
            code: 'TARGET_PROJECT_AMBIGUOUS',
            feishuReplyText: buildAmbiguousTargetFeishuReply(
              normalizeTargetProjects(agentsCfg)
            ),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 多目标歧义');
          return;
        }
        if (pick.kind === 'unknown_id') {
          logger.info('返回响应', {
            flow: 'respond',
            httpStatus: 200,
            kind: 'target_projects_unknown_id',
          });
          respondFeishuJson(200, {
            ok: false,
            code: 'TARGET_PROJECT_UNKNOWN',
            feishuReplyText: [
              `未找到目标项目 id：「${pick.targetId}」。`,
              '',
              '发「目标列表」查看已配置的 id，或检查拼写。',
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 目标 id 无效');
          return;
        }
        workspaceResolution = {
          workspacePathAbsolute: pick.workspacePathAbsolute,
          targetProjectId: pick.targetProjectId,
        };
        if (action === 'code') {
          const codingPrereqs = collectCodingFeishuPrereqIssues(process.env, {
            effectiveWorkspacePathTrimmed: pick.workspacePathAbsolute,
          });
          if (codingPrereqs.length > 0) {
            logger.info('返回响应', {
              flow: 'respond',
              httpStatus: 200,
              kind: 'coding_prerequisites_missing',
              issues: codingPrereqs,
            });
            respondFeishuJson(200, {
              ok: false,
              code: 'CODING_PREREQUISITES_MISSING',
              issues: codingPrereqs,
              feishuReplyText:
                buildCodingPrereqBlockedFeishuReply(codingPrereqs),
            });
            teeFeishuFlow('>>> ⑦ 响应', '200 编码前置配置缺失');
            return;
          }
        }
      }

      const parsedExplicitReq = parseRequirementsAnalysisMessage(text);
      const requirementMsgShape =
        action !== 'requirements_analysis'
          ? ({ kind: 'create' as const })
          : parsedExplicitReq.kind === 'revision'
            ? parsedExplicitReq
            : quotedThreadTaskId !== undefined
              ? {
                  kind: 'revision' as const,
                  baseTaskId: quotedThreadTaskId,
                  instruction: stripOptionalRequirementsPrefix(text),
                }
              : ({ kind: 'create' as const });

      const runAnalyzeAndPersistRequirements = async (params: {
        readonly taskRecord: NonNullable<Awaited<ReturnType<ITaskStore['getTask']>>>;
        readonly rawForAgent: string;
        readonly mode?: 'revise';
        readonly priorPrdMarkdown?: string;
      }): Promise<{
        readonly analysis: IRequirementsAnalysisResponse;
        readonly task: NonNullable<Awaited<ReturnType<ITaskStore['getTask']>>>;
      }> => {
        const tid = params.taskRecord.taskId;
        const analysis = await analyzeRequirementsHttp({
          taskId: tid,
          ...(params.mode === 'revise' && params.priorPrdMarkdown !== undefined
            ? {
                mode: 'revise' as const,
                priorPrdMarkdown: params.priorPrdMarkdown,
              }
            : {}),
          rawRequirement: params.rawForAgent,
        });
        const updated = await taskStore.updateTask(tid, {
          status: 'completed',
          metadata: {
            ...(params.taskRecord.metadata ?? {}),
            requirementsMarkdown: analysis.markdown,
            prdStatus: analysis.prdStatus,
          },
        });
        if (updated === null) {
          throw new AppError('INTERNAL', '更新任务失败（requirements）', 500);
        }
        return { analysis, task: updated };
      };

      /** 在原任务上修订 PRD：不写新任务记录，沿用原 taskId。 */
      if (requirementMsgShape.kind === 'revision') {
        const gateRev = await assertNoConcurrentExclusiveTask(taskStore, action, {
          channelId,
        });
        if (!gateRev.ok) {
          logger.warn('并发门禁：已拒绝（需求修订）', {
            flow: 'respond',
            httpStatus: 409,
            requestedAction: action,
            blockingTaskId: gateRev.existingTask.taskId,
          });
          respondFeishuJson(409, {
            ok: false,
            code: 'CONCURRENT_TASK',
            requestedAction: action,
            existingTask: gateRev.existingTask,
            feishuReplyText: gateRev.feishuReplyText,
          });
          teeFeishuFlow('>>> ⑦ 响应', '409 并发拦截(修订)');
          return;
        }

        const baseTask = await taskStore.getTask(requirementMsgShape.baseTaskId);
        if (baseTask === null) {
          respondFeishuJson(200, {
            ok: false,
            code: 'TASK_NOT_FOUND',
            feishuReplyText: [
              '找不到要修订的任务 ID。',
              `请核对后重试：` + requirementMsgShape.baseTaskId,
              '任务 ID 在每次「需求分析」完成摘要的第一行可见；可复制后使用「需求分析 修订 <任务ID>：你的补充」。',
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 修订目标不存在');
          return;
        }
        if (baseTask.action !== 'requirements_analysis') {
          respondFeishuJson(200, {
            ok: false,
            code: 'TASK_NOT_REQUIREMENTS_ANALYSIS',
            feishuReplyText: [
              `该任务不是「需求分析」记录，无法在此处合并修订。`,
              `任务 ID：${baseTask.taskId}`,
              baseTask.action !== undefined ? `类型：${baseTask.action}` : '',
            ]
              .filter((s) => s !== '')
              .join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 任务类型不符');
          return;
        }
        if (baseTask.status === 'running') {
          respondFeishuJson(200, {
            ok: false,
            code: 'TASK_ALREADY_RUNNING',
            feishuReplyText: [
              `该需求分析任务仍在执行中，暂不能修订。`,
              `任务 ID：${baseTask.taskId}`,
              '请待完成后再发起修订。',
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 任务进行中');
          return;
        }

        const priorMd = baseTask.metadata?.requirementsMarkdown;
        if (typeof priorMd !== 'string' || priorMd.trim() === '') {
          respondFeishuJson(200, {
            ok: false,
            code: 'NO_PRIOR_PRD_MD',
            feishuReplyText: [
              '该任务下尚无可合并的 PRD 正文。',
              `请先对已完成的任务确认是否已有「requirementsMarkdown」，或先发一次完整「需求分析：…」。`,
              `任务 ID：${baseTask.taskId}`,
            ].join('\n'),
          });
          teeFeishuFlow('>>> ⑦ 响应', '200 无上一版正文');
          return;
        }

        const delta =
          requirementMsgShape.instruction.trim() !== ''
            ? requirementMsgShape.instruction.trim()
            : '（本条未给出具体条文）请在保持上一版需求范围的前提下做一致性合并，仅修正矛盾、缺漏与表述。';

        const mergedMeta: Record<string, unknown> = {
          ...(baseTask.metadata ?? {}),
          source: 'feishu_webhook',
          ...rootMeta,
          ...(channelId !== undefined ? { channelId } : {}),
          lastRequirementsReviseInbound: text,
          lastRequirementsReviseAt: new Date().toISOString(),
        };

        await taskStore.updateTask(baseTask.taskId, {
          status: 'running',
          message: text,
          metadata: mergedMeta,
        });

        logger.info('任务已更新为修订运行中', {
          flow: 'task',
          taskId: baseTask.taskId,
          action,
        });
        teeFeishuFlow('>>> ④ 修订（沿用任务）', baseTask.taskId);

        logger.info('执行步骤', {
          flow: 'execute',
          taskId: baseTask.taskId,
          step: 'requirements_agent_revise',
          stage: 'start',
        });
        teeFeishuFlow('>>> ⑤ 执行中', '需求分析（修订）→ requirements-agent');

        try {
          const { analysis, task } = await runAnalyzeAndPersistRequirements({
            taskRecord: { ...baseTask, metadata: mergedMeta },
            rawForAgent: delta,
            mode: 'revise',
            priorPrdMarkdown: priorMd,
          });
          logger.info('执行步骤', {
            flow: 'execute',
            taskId: baseTask.taskId,
            step: 'requirements_agent_revise',
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
            taskId: baseTask.taskId,
            action: 'requirements_analysis',
            outcome: 'revised',
          });
          respondFeishuJson(
            201,
            {
              ok: true,
              task,
              requirementsAnalysis: analysis,
              requirementsReviseMode: true,
              feishuReplyText: [
                `【需求分析 · 修订】${analysis.prdStatus}｜同一任务 ${baseTask.taskId}`,
                '',
                preview,
              ].join('\n'),
            },
            {
              onOutboundSettled: (sr) => {
                if (
                  sr.kind === 'ok' &&
                  sr.messageId !== undefined &&
                  sr.messageId !== ''
                ) {
                  registerFeishuPrdOutboundAnchor(
                    sr.messageId,
                    baseTask.taskId
                  );
                }
              },
            }
          );
          teeFeishuFlow(
            '>>> ⑦ 响应',
            `201 需求分析修订完成 | ${analysis.prdStatus} | ${baseTask.taskId}`
          );
          return;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          teeFeishuFlow('>>> ✖ 失败', `需求分析修订 ${errMsg.slice(0, 120)}`);
          logger.warn('执行步骤', {
            flow: 'execute',
            taskId: baseTask.taskId,
            step: 'requirements_agent_revise',
            stage: 'failed',
            error: errMsg,
          });
          await taskStore.updateTask(baseTask.taskId, {
            status: 'failed',
            metadata: {
              ...mergedMeta,
              requirementsRevisionError: errMsg,
            },
          });
          throw new AppError(
            'REQUIREMENTS_AGENT_FAILED',
            `需求分析修订失败：${errMsg}`,
            502
          );
        }
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
          ...(workspaceResolution !== undefined
            ? {
                targetProjectId: workspaceResolution.targetProjectId,
                resolvedTargetWorkspacePath:
                  workspaceResolution.workspacePathAbsolute,
              }
            : {}),
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
          const { analysis, task: completedTask } =
            await runAnalyzeAndPersistRequirements({
              taskRecord: task,
              rawForAgent: text,
            });
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
          respondFeishuJson(
            201,
            {
              ok: true,
              task: completedTask,
              requirementsAnalysis: analysis,
              feishuReplyText: [
                `【需求分析】${analysis.prdStatus}｜任务 ${task.taskId}`,
                '',
                preview,
              ].join('\n'),
            },
            {
              onOutboundSettled: (sr) => {
                if (
                  sr.kind === 'ok' &&
                  sr.messageId !== undefined &&
                  sr.messageId !== ''
                ) {
                  registerFeishuPrdOutboundAnchor(sr.messageId, task.taskId);
                }
              },
            }
          );
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
            instruction: instructionBodyForWorkspaceActions,
            ...(workspaceResolution !== undefined
              ? { workspacePath: workspaceResolution.workspacePathAbsolute }
              : {}),
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
            ...(workspaceResolution !== undefined
              ? { workspacePath: workspaceResolution.workspacePathAbsolute }
              : {}),
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
            ...(workspaceResolution !== undefined
              ? { workspacePath: workspaceResolution.workspacePathAbsolute }
              : {}),
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
      };

      try {
        await runInbound();
        if (inboundDedupKey !== null) {
          finishFeishuInboundDedup(inboundDedupKey, true);
        }
      } catch (dedupInner: unknown) {
        if (inboundDedupKey !== null) {
          finishFeishuInboundDedup(inboundDedupKey, false);
        }
        throw dedupInner;
      }
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
