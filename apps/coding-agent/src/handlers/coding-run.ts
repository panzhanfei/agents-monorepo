import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import {
  CUSTOMER_TARGETS_ROOT_REL,
  evaluateCodingWorkspaceConfigAsync,
  resolveWorkspacePath,
  TARGET_PROJECT_ID_RE,
  type ICodingWorkspaceConfigReport,
} from '@agents/agents-config';
import type {
  ICodingRunConfigAssessment,
  ICodingRunResponse,
} from '@agents/pipeline-core';
import { z } from 'zod';
import { applyCodingWorkspace } from '../services/coding-workspace-apply.js';

const maxInstructionChars = 200_000;

const codingRunBodySchema = z.object({
  taskId: z.string().min(1),
  instruction: z.string().min(1).max(maxInstructionChars),
  workspacePath: z.string().optional(),
  workspaceLifecycle: z.enum(['existing', 'greenfield']).optional(),
  customerTargetProjectId: z.string().regex(TARGET_PROJECT_ID_RE).optional(),
});

const mapReportToAssessment = (
  report: ICodingWorkspaceConfigReport
): ICodingRunConfigAssessment => ({
  workspacePathResolved: report.workspaceResolved,
  workspaceLifecycleApplied: report.workspaceLifecycleApplied,
  ...(report.greenfieldDirectoryCreated === true
    ? { greenfieldDirectoryCreated: true }
    : {}),
  blockingIssues: report.blockingIssues,
  reviewProfileUsed: report.reviewProfileUsed,
  aiRulesGlobUsed: report.aiRulesGlobEffective,
  workspaceAiRuleFilesMatchedCount:
    report.workspaceAiRuleFilesMatchedCount,
  orchestrationAiRuleFilesMatchedCount:
    report.orchestrationAiRuleFilesMatchedCount,
  aiRuleFilesMatchedCount: report.aiRuleFilesMatchedCount,
  suggestCustomerConfirmWithoutMatchedAiRules:
    report.suggestCustomerConfirmWithoutMatchedAiRules,
});

const buildConfigMarkdown = (
  assessment: ICodingRunConfigAssessment,
  opts?: { readonly customerTargetProjectId?: string }
): string => {
  const lifecycleLine =
    assessment.workspaceLifecycleApplied === 'greenfield'
      ? `- **工作区**：\`${assessment.workspacePathResolved}\`（新项目 / greenfield · 自检可创建缺失目录${assessment.greenfieldDirectoryCreated === true ? '，本次已新建' : ''}）`
      : `- **客户工作区**：\`${assessment.workspacePathResolved}\`（既有路径须已存在；= 目标 \`target.yaml\` → \`workspacePath\`，**编码只写此目录**）`;

  const lines: string[] = ['### 编码前 · 配置自检', ''];

  const tid = opts?.customerTargetProjectId?.trim() ?? '';
  if (tid !== '') {
    lines.push(
      `> **为何不是 \`${CUSTOMER_TARGETS_ROOT_REL}/${tid}/\`？** 该目录只是编排仓里的**目标元数据**（\`target.yaml\`、控制台上传的 \`ai-rules/\` 等），**不是客户业务仓库**。你在 \`target.yaml\` 里配的 \`workspacePath\` 才是下面这行路径；脚手架与需求文档会落在那里。`,
      ''
    );
  }

  lines.push(
    lifecycleLine,
    `- **审核 profile（门禁同源）**：${assessment.reviewProfileUsed !== '' ? `\`${assessment.reviewProfileUsed}\`` : '（YAML 校验失败或未解析）'}`,
    `- **编排规则（仅 Agent Console 上传）**：${assessment.aiRulesGlobUsed}`,
    `- **已上传规则文件数**：${String(assessment.orchestrationAiRuleFilesMatchedCount)}`,
    ''
  );

  if (assessment.blockingIssues.length > 0) {
    lines.push('#### 必须先处理的阻断项');
    assessment.blockingIssues.forEach((b, i) => {
      lines.push(
        `${i + 1}. **${b.code}**`,
        `   ${b.remediation}`,
        ''
      );
    });
  }

  if (assessment.blockingIssues.length === 0) {
    lines.push(
      '**可选但强烈建议：**',
      '- 与客户仓 **同源**门禁命令（参见 `agents.config.yaml` → `review.profiles.*.blockingCommands`，由 **review-agent** 执行）；',
      '- 编排 outbound：\`CODING_AGENT_INTERNAL_TOKEN\` 需与编排器一致（若启用 Bearer）；不写 \`CODING_AGENT_BASE_URL\` 时由编排器按端口自动拼本地地址（自检提示同）。',
      ''
    );

    if (assessment.suggestCustomerConfirmWithoutMatchedAiRules) {
      lines.push(
        '#### 需在飞书里请客户口头确认的一步',
        '',
        '在 **Agent Console · 编排审核规则** 中，`customer-targets/<目标 id>/ai-rules/` 下 **尚无已上传的规则文件**。建议先在控制台上传 `.mdc` / `.md` 再继续全自动编码。',
        '- 或由产品在飞书里与客户确认暂缓规则。',
        '',
        '> 本条为产品提示：**不影响**本次在工作区的需求落盘与代码围栏写入；后续若接 LLM 自动改仓可再结合门禁收口。',
        ''
      );
    }
  }

  return lines.join('\n');
};

const assembleSummaryMarkdown = (opts: {
  readonly taskId: string;
  readonly instructionSnippet: string;
  readonly workspaceForLog: string;
  readonly assessment: ICodingRunConfigAssessment;
  readonly accepted: boolean;
  readonly applySummaryLines?: readonly string[];
  readonly customerTargetProjectId?: string;
}): string => {
  const intro = opts.accepted
    ? [
        `## 编码任务｜任务 **${opts.taskId}**`,
        '',
        '已在客户工作区完成 **需求合并**；若无工程清单则按 **需求中的技术关键词** 或（已配置时）**LLM 解析 `LLM_BASE_URL` + `LLM_MODEL`** 选择脚手架模板并落盘；也可用带路径的 Markdown 代码围栏直接写文件。本地需 `npm install` / `pnpm install` 后启动。',
        '',
      ].join('\n')
    : [
        `## 编码任务自检未通过｜任务 **${opts.taskId}**`,
        '',
        '因存在 **阻断项**，当前无法在客户项目上安全衔接后续自动编码。**请先按下方逐项补齐或修正**；审核门禁仍由原 review-agent 负责。',
        '',
      ].join('\n');

  return [
    intro,
    buildConfigMarkdown(opts.assessment, {
      ...(opts.customerTargetProjectId !== undefined &&
      opts.customerTargetProjectId.trim() !== ''
        ? { customerTargetProjectId: opts.customerTargetProjectId.trim() }
        : {}),
    }),
    ...(opts.accepted && opts.applySummaryLines !== undefined
      ? opts.applySummaryLines
      : []),
    opts.workspaceForLog !== ''
      ? `_进程解析工作区_: \`${opts.workspaceForLog}\`_`
      : '_若未传入 `workspacePath` 且无有效 `TARGET_WORKSPACE_PATH` env，请将客户项目路径配好后再试。_',
    '',
    '### 需求/说明原文',
    '',
    opts.instructionSnippet,
  ].join('\n');
};

export const createCodingRunHandler = (
  logger: ILogger,
  monorepoRoot: string
): RequestHandler => {
  return async (req, res, next) => {
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

      const workspaceReport = await evaluateCodingWorkspaceConfigAsync({
        monorepoRoot,
        workspaceAbsolute: workspace,
        ...(parsed.data.workspaceLifecycle !== undefined
          ? { workspaceLifecycle: parsed.data.workspaceLifecycle }
          : {}),
        ...(parsed.data.customerTargetProjectId !== undefined &&
        parsed.data.customerTargetProjectId.trim() !== ''
          ? {
              customerTargetProjectId:
                parsed.data.customerTargetProjectId.trim(),
            }
          : {}),
      });
      const configAssessment = mapReportToAssessment(workspaceReport);

      const accepted = configAssessment.blockingIssues.length === 0;

      const applyResult = accepted
        ? await applyCodingWorkspace({
            workspaceRoot: workspaceReport.workspaceResolved,
            taskId,
            instruction,
            workspaceLifecycleApplied:
              configAssessment.workspaceLifecycleApplied ?? 'existing',
          })
        : undefined;

      const clipped =
        instruction.length > 4000
          ? `${instruction.slice(0, 4000)}\n\n…（已截断）`
          : instruction;

      const summaryMarkdown = assembleSummaryMarkdown({
        taskId,
        instructionSnippet: clipped,
        workspaceForLog: workspace,
        assessment: configAssessment,
        accepted,
        ...(applyResult !== undefined
          ? { applySummaryLines: applyResult.applySummaryLines }
          : {}),
        ...(parsed.data.customerTargetProjectId !== undefined &&
        parsed.data.customerTargetProjectId.trim() !== ''
          ? { customerTargetProjectId: parsed.data.customerTargetProjectId.trim() }
          : {}),
      });

      logger.info('coding_run_config_eval', {
        taskId,
        instructionLen: instruction.length,
        workspacePathResolved: configAssessment.workspacePathResolved,
        workspaceLifecycleApplied:
          configAssessment.workspaceLifecycleApplied ?? 'existing',
        greenfieldDirectoryCreated:
          configAssessment.greenfieldDirectoryCreated ?? false,
        accepted,
        blockingCount: configAssessment.blockingIssues.length,
        aiRuleFilesMatchedCount: configAssessment.aiRuleFilesMatchedCount,
        suggestConfirmNoRules:
          configAssessment.suggestCustomerConfirmWithoutMatchedAiRules,
        ...(applyResult !== undefined
          ? {
              scaffoldApplied: applyResult.scaffoldApplied,
              filesWrittenCount: applyResult.filesWrittenRelative.length,
              stackChoiceSource: applyResult.stackChoice?.source,
              stackId: applyResult.stackChoice?.stackId,
            }
          : {}),
      });

      const body: ICodingRunResponse & { ok: boolean } = {
        ok: true,
        taskId,
        accepted,
        summaryMarkdown,
        configAssessment,
        ...(accepted
          ? {
              note: 'workspace write: requirement doc + optional scaffold + fenced files',
              ...(applyResult !== undefined
                ? {
                    filesWritten: applyResult.filesWrittenRelative,
                    scaffoldApplied: applyResult.scaffoldApplied,
                    ...(applyResult.stackChoice !== undefined
                      ? { stackChoice: applyResult.stackChoice }
                      : {}),
                    ...(applyResult.applyWarnings.length > 0
                      ? { applyWarnings: applyResult.applyWarnings }
                      : {}),
                  }
                : {}),
            }
          : {
              note: 'config blocking: remediate blockingIssues before full coding rollout',
            }),
      };

      res.json(body);
    } catch (e) {
      next(e);
    }
  };
};
