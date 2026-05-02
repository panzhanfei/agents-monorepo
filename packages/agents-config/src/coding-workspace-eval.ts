import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { loadAgentsConfig } from './load-agents-config.js';
import { resolveReviewExecutionConfig } from './resolved-review.js';

export type ICodingBlockingIssue = {
  readonly code: string;
  readonly remediation: string;
};

export type ICodingWorkspaceConfigReport = {
  readonly workspaceResolved: string;
  readonly blockingIssues: readonly ICodingBlockingIssue[];
  readonly reviewProfileUsed: string;
  readonly aiRulesGlobEffective: string;
  readonly aiRuleFilesMatchedCount: number;
  /**
   * 工作区可访问且结构配置合法，但当前 glob 未匹配到任何文件——建议由产品上向客户做一次确认后再全自动改代码。
   */
  readonly suggestCustomerConfirmWithoutMatchedAiRules: boolean;
};

/**
 * 与 review-agent「AI 规则」同源：取自 `agents.config.yaml` active profile + env `REVIEW_*`。
 * 对客户项目目录只做只读枚举，不加载文件内容。
 */
export const evaluateCodingWorkspaceConfigAsync = async (opts: {
  readonly monorepoRoot: string;
  readonly workspaceAbsolute: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<ICodingWorkspaceConfigReport> => {
  const env = opts.env ?? process.env;
  const workspaceResolved = path.resolve(opts.workspaceAbsolute);
  const blocking: ICodingBlockingIssue[] = [];

  if (!fs.existsSync(workspaceResolved)) {
    blocking.push({
      code: 'WORKSPACE_NOT_FOUND',
      remediation:
        '工作区路径在磁盘上不存在。请在 `.env` 设置准确的 `TARGET_WORKSPACE_PATH`，或由编排器传入 `workspacePath`（推荐使用客户项目根的绝对路径），并确认本机有权访问。',
    });
  } else if (!fs.statSync(workspaceResolved).isDirectory()) {
    blocking.push({
      code: 'WORKSPACE_NOT_DIRECTORY',
      remediation:
        '`workspacePath` 指向的不是目录。请将路径更正为客户业务仓库的根目录。',
    });
  }

  let reviewProfileUsed = '';
  let aiRulesGlobEffective = '';
  let aiRuleFilesMatchedCount = 0;

  if (blocking.length === 0) {
    try {
      const cfg = await loadAgentsConfig(
        { monorepoRoot: opts.monorepoRoot },
        env
      );
      const resolved = resolveReviewExecutionConfig(cfg, env);
      reviewProfileUsed = resolved.profileName;
      aiRulesGlobEffective = resolved.aiRulesGlob;
      aiRuleFilesMatchedCount = fg.sync(resolved.aiRulesGlob, {
        cwd: workspaceResolved,
        onlyFiles: true,
        dot: true,
        ignore: ['**/node_modules/**'],
      }).length;
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      blocking.push({
        code: 'AGENTS_OR_REVIEW_CONFIG_INVALID',
        remediation:
          `无法读取本编排仓的 agents 配置或未解析审核 profile：${hint}。请检查仓库根目录的 agents.config.yaml、环境变量 REVIEW_RULES_PROFILE / REVIEW_AIRULES_GLOB 是否与审核门禁一致（参考 \`.env.example\`）。`,
      });
    }
  }

  const suggestCustomerConfirmWithoutMatchedAiRules =
    blocking.length === 0 && aiRuleFilesMatchedCount === 0;

  return {
    workspaceResolved,
    blockingIssues: blocking,
    reviewProfileUsed,
    aiRulesGlobEffective,
    aiRuleFilesMatchedCount,
    suggestCustomerConfirmWithoutMatchedAiRules,
  };
};
