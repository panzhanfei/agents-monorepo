import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

import {
  CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  CUSTOMER_TARGETS_ROOT_REL,
  TARGET_PROJECT_ID_RE,
} from './schema.js';
import {
  absoluteCustomerTargetAiRulesPath,
} from './customer-target-projects-layout.js';
import { loadAgentsConfig } from './load-agents-config.js';
import { resolveReviewExecutionConfig } from './resolved-review.js';

/** 审核可读规则文件后缀（与 review-agent load-rules 一致）。 */
const RULE_TEXT_EXT = new Set([
  '.md',
  '.mdc',
  '.txt',
  '.yaml',
  '.yml',
  '.json',
]);

const countOrchestrationAiRuleFilesSync = (
  monorepoRoot: string,
  projectId: string,
): number => {
  const abs = absoluteCustomerTargetAiRulesPath(monorepoRoot, projectId);
  if (
    !fs.existsSync(abs) ||
    !fs.statSync(abs).isDirectory()
  ) {
    return 0;
  }
  const files = fg.sync('**/*', {
    cwd: abs,
    onlyFiles: true,
    dot: true,
    ignore: ['**/node_modules/**'],
  });
  let n = 0;
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (ext !== '' && !RULE_TEXT_EXT.has(ext)) {
      continue;
    }
    n += 1;
  }
  return n;
};

const describeTargetOrchestrationRules = (projectId: string): string =>
  `${CUSTOMER_TARGETS_ROOT_REL}/${projectId}/${CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT}（Agent Console 上传）`;

export type ICodingBlockingIssue = {
  readonly code: string;
  readonly remediation: string;
};

export type ICodingWorkspaceConfigReport = {
  readonly workspaceResolved: string;
  /** 自检采用的策略：`greenfield` 时允许曾不存在并由本函数 `mkdir`。 */
  readonly workspaceLifecycleApplied: 'existing' | 'greenfield';
  /** 因在 `greenfield` 模式下创建目录后为 true（用于摘要说明）。 */
  readonly greenfieldDirectoryCreated?: boolean;
  readonly blockingIssues: readonly ICodingBlockingIssue[];
  readonly reviewProfileUsed: string;
  /** 编排侧 ai-rules 说明（占位字段名沿用 pipeline-core） */
  readonly aiRulesGlobEffective: string;
  /** 已不再从客户仓扫 glob；目标项目自检恒为 0 */
  readonly workspaceAiRuleFilesMatchedCount: number;
  /** `customer-targets/<projectId>/ai-rules` 命中条数 */
  readonly orchestrationAiRuleFilesMatchedCount: number;
  readonly aiRuleFilesMatchedCount: number;
  /**
   * 已绑定目标但编排侧尚无上传规则时为 true（建议控制台补 `.mdc` 后再全自动编码）。
   */
  readonly suggestCustomerConfirmWithoutMatchedAiRules: boolean;
};

/**
 * 目标项目自检：仅以 `customer-targets/<customerTargetProjectId>/ai-rules`（控制台上传）
 * 统计规则命中；不再读取客户仓库内 glob。
 */
export const evaluateCodingWorkspaceConfigAsync = async (opts: {
  readonly monorepoRoot: string;
  readonly workspaceAbsolute: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly customerTargetProjectId?: string;
  /** `greenfield`：目录缺失时自检阶段递归创建客户项目根。 */
  readonly workspaceLifecycle?: 'existing' | 'greenfield';
}): Promise<ICodingWorkspaceConfigReport> => {
  const env = opts.env ?? process.env;
  const workspaceResolved = path.resolve(opts.workspaceAbsolute);
  const lifecycle: 'existing' | 'greenfield' =
    opts.workspaceLifecycle === 'greenfield' ? 'greenfield' : 'existing';

  const blocking: ICodingBlockingIssue[] = [];
  let greenfieldDirectoryCreated: boolean | undefined;

  const pathExistedInitially = fs.existsSync(workspaceResolved);
  if (!pathExistedInitially) {
    if (lifecycle === 'greenfield') {
      try {
        fs.mkdirSync(workspaceResolved, { recursive: true });
        greenfieldDirectoryCreated = true;
      } catch (e: unknown) {
        const hint = e instanceof Error ? e.message : String(e);
        blocking.push({
          code: 'GREENFIELD_MKDIR_FAILED',
          remediation: `「新项目」模式无法创建编码目录（${hint}）。请改为已存在的路径、检查父目录权限，或改用 \`workspaceLifecycle: existing\` 并先手建目录。`,
        });
      }
    } else {
      blocking.push({
        code: 'WORKSPACE_NOT_FOUND',
        remediation:
          '工作区路径在磁盘上不存在。若为全新项目请在目标配置中设 \`workspaceLifecycle: greenfield\`（或由控制台选「新项目」）；否则请在 `.env`/编排器中为 \`workspacePath\` 指定已存在的客户仓根。',
      });
    }
  }

  if (blocking.length === 0 && fs.existsSync(workspaceResolved)) {
    if (!fs.statSync(workspaceResolved).isDirectory()) {
      blocking.push({
        code: 'WORKSPACE_NOT_DIRECTORY',
        remediation:
          '`workspacePath` 指向的不是目录。请将路径更正为客户业务仓库的根目录。',
      });
    }
  }

  if (blocking.length === 0 && !fs.existsSync(workspaceResolved)) {
    blocking.push({
      code: 'WORKSPACE_MISSING',
      remediation:
        '工作区路径在自检过程中变为不可用（极少见）。请重试「编码」，或检查是否与外部进程争抢同一目录。',
    });
  }

  let reviewProfileUsed = '';
  let aiRulesGlobEffective = '';
  const workspaceAiRuleFilesMatchedCount = 0;
  let orchestrationAiRuleFilesMatchedCount = 0;

  if (blocking.length === 0) {
    try {
      const cfg = await loadAgentsConfig(
        { monorepoRoot: opts.monorepoRoot },
        env,
      );
      const resolved = resolveReviewExecutionConfig(cfg, env);
      reviewProfileUsed = resolved.profileName;
      const tid = opts.customerTargetProjectId?.trim() ?? '';

      if (tid !== '' && TARGET_PROJECT_ID_RE.test(tid)) {
        orchestrationAiRuleFilesMatchedCount =
          countOrchestrationAiRuleFilesSync(opts.monorepoRoot, tid);
        aiRulesGlobEffective = describeTargetOrchestrationRules(tid);
      } else {
        aiRulesGlobEffective =
          '（缺少 customerTargetProjectId — 无法在自检中挂载编排上传目录；飞书／编排器请选择目标后再跑编码）';
      }
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      blocking.push({
        code: 'AGENTS_OR_REVIEW_CONFIG_INVALID',
        remediation:
          `无法读取本编排仓的 agents 配置或未解析审核 profile：${hint}。请检查仓库根目录的 agents.config.yaml、环境变量 REVIEW_RULES_PROFILE 等是否与审核门禁一致（参考 \`.env.example\`）。`,
      });
    }
  }

  const aiRuleFilesMatchedCount = orchestrationAiRuleFilesMatchedCount;

  const tidSuggest = opts.customerTargetProjectId?.trim() ?? '';

  const suggestCustomerConfirmWithoutMatchedAiRules =
    blocking.length === 0 &&
    tidSuggest !== '' &&
    TARGET_PROJECT_ID_RE.test(tidSuggest) &&
    aiRuleFilesMatchedCount === 0;

  return {
    workspaceResolved,
    workspaceLifecycleApplied: lifecycle,
    ...(greenfieldDirectoryCreated === true
      ? { greenfieldDirectoryCreated: true }
      : {}),
    blockingIssues: blocking,
    reviewProfileUsed,
    aiRulesGlobEffective,
    workspaceAiRuleFilesMatchedCount,
    orchestrationAiRuleFilesMatchedCount,
    aiRuleFilesMatchedCount,
    suggestCustomerConfirmWithoutMatchedAiRules,
  };
};
