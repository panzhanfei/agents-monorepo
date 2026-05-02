import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import {
  evaluateCodingWorkspaceConfigAsync,
  resolveWorkspacePath,
  type ICodingWorkspaceConfigReport,
} from '@agents/agents-config';
import type {
  ICodingRunConfigAssessment,
  ICodingRunResponse,
} from '@agents/pipeline-core';
import { z } from 'zod';

const maxInstructionChars = 200_000;

const codingRunBodySchema = z.object({
  taskId: z.string().min(1),
  instruction: z.string().min(1).max(maxInstructionChars),
  workspacePath: z.string().optional(),
});

const mapReportToAssessment = (
  report: ICodingWorkspaceConfigReport
): ICodingRunConfigAssessment => ({
  workspacePathResolved: report.workspaceResolved,
  blockingIssues: report.blockingIssues,
  reviewProfileUsed: report.reviewProfileUsed,
  aiRulesGlobUsed: report.aiRulesGlobEffective,
  aiRuleFilesMatchedCount: report.aiRuleFilesMatchedCount,
  suggestCustomerConfirmWithoutMatchedAiRules:
    report.suggestCustomerConfirmWithoutMatchedAiRules,
});

const buildConfigMarkdown = (assessment: ICodingRunConfigAssessment): string => {
  const lines: string[] = [
    '### 编码前 · 配置自检',
    '',
    `- **客户工作区**：\`${assessment.workspacePathResolved}\``,
    `- **审核同源 profile**：${assessment.reviewProfileUsed !== '' ? `\`${assessment.reviewProfileUsed}\`` : '（YAML 校验失败或未解析）'}`,
    `- **AI 规则 glob**（与客户仓 \`agents.config.yaml\` profile + 环境变量 \`REVIEW_AIRULES_GLOB\` 一致）：\`${assessment.aiRulesGlobUsed}\``,
    `- **匹配到的规则文件数**：${String(assessment.aiRuleFilesMatchedCount)}`,
    '',
  ];

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
      '- `.env` 中 \`CODING_AGENT_BASE_URL\` / \`CODING_AGENT_INTERNAL_TOKEN\` 与编排器对齐（已由编排器侧自检时提示）。',
      ''
    );

    if (assessment.suggestCustomerConfirmWithoutMatchedAiRules) {
      lines.push(
        '#### 需在飞书里请客户口头确认的一步',
        '',
        '在当前工作区 **未匹配到任何 AI 规则文件**（见上 glob）。产品上建议 **先发飞书让客户确认**：',
        '- 是否接受在 **暂不配置 Cursor 仓库规则（如 `.cursor/rules/**/*.mdc`）** 的情况下继续由自动化编码（风格与护栏较弱）；',
        '- 或直接让对方在客户项目里补上规则后再跑。',
        '',
        '> 本条 **不阻断** 当前占位版 coding-agent（不自动改仓库）；后续接入真实改代码时需结合编排器门禁或状态机收口。',
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
}): string => {
  const intro = opts.accepted
    ? [
        `## 编码任务（MVP 占位）｜任务 **${opts.taskId}**`,
        '',
        '当前 **coding-agent** 仍为占位：不写仓库、不调模型；仅做 **配置自检** 与摘要。**代码审核（review-agent）** 链路不变。',
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
    buildConfigMarkdown(opts.assessment),
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
      });
      const configAssessment = mapReportToAssessment(workspaceReport);

      const accepted = configAssessment.blockingIssues.length === 0;

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
      });

      logger.info('coding_run_config_eval', {
        taskId,
        instructionLen: instruction.length,
        workspacePathResolved: configAssessment.workspacePathResolved,
        accepted,
        blockingCount: configAssessment.blockingIssues.length,
        aiRuleFilesMatchedCount: configAssessment.aiRuleFilesMatchedCount,
        suggestConfirmNoRules:
          configAssessment.suggestCustomerConfirmWithoutMatchedAiRules,
      });

      const body: ICodingRunResponse & { ok: boolean } = {
        ok: true,
        taskId,
        accepted,
        summaryMarkdown,
        configAssessment,
        ...(accepted
          ? {
              note: 'stub: replace with real coding pipeline when ready',
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
