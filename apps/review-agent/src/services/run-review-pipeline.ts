import fs from 'node:fs/promises';
import type { ILogger } from '@agents/logger';
import type {
  IReviewGateCommandResult,
  IReviewRunRequest,
  IReviewRunResponse,
} from '@agents/pipeline-core';
import {
  TARGET_PROJECT_ID_RE,
  absoluteCustomerTargetAiRulesPath,
  loadAgentsConfig,
  resolveReviewExecutionConfig,
  resolveWorkspacePath,
  runShellCommand,
} from '@agents/agents-config';
import type { ILlmEnvConfig } from '../config/env.js';
import { loadReviewRulesBundle } from '../review/load-rules.js';
import { runSemanticReview } from '../review/semantic-review.js';

export type IRunReviewDeps = {
  readonly logger: ILogger;
  readonly monorepoRoot: string;
  readonly llm: ILlmEnvConfig;
};

export const runReviewPipeline = async (
  input: IReviewRunRequest,
  deps: IRunReviewDeps
): Promise<IReviewRunResponse> => {
  const workspace = resolveWorkspacePath(deps.monorepoRoot, input.workspacePath);
  await fs.access(workspace).catch(() => {
    throw new Error(`工作区不存在或不可访问：${workspace}`);
  });

  const cfg = await loadAgentsConfig({ monorepoRoot: deps.monorepoRoot });
  const reviewCfg = resolveReviewExecutionConfig(cfg, process.env);

  const tidRaw = input.customerTargetProjectId?.trim() ?? '';
  const targetUsesOrchestrationRulesOnly =
    tidRaw !== '' && TARGET_PROJECT_ID_RE.test(tidRaw);

  const gateTimeout = Number(process.env.REVIEW_GATE_TIMEOUT_MS ?? '600000');
  const gateResults: IReviewGateCommandResult[] = [];
  let gatePassed = true;

  for (const cmd of reviewCfg.blockingCommands) {
    const r = await runShellCommand({
      cwd: workspace,
      script: cmd,
      timeoutMs: gateTimeout,
    });
    gateResults.push({
      command: cmd,
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      stdoutTail: r.stdout,
      stderrTail: r.stderr,
    });
    if (r.timedOut || r.exitCode !== 0) {
      gatePassed = false;
      break;
    }
  }

  const skipLlmFlag =
    process.env.REVIEW_SKIP_LLM?.trim() === 'true' ||
    process.env.REVIEW_SKIP_LLM === '1';

  if (!gatePassed) {
    return {
      taskId: input.taskId,
      profileName: reviewCfg.profileName,
      overallPassed: false,
      blockingGate: { passed: false, results: gateResults },
      llm: {
        skipped: true,
        skipReason: 'blocking_gate_failed',
        blocking: [],
        warnings: [],
        summaryMarkdown: '',
      },
    };
  }

  if (skipLlmFlag) {
    return {
      taskId: input.taskId,
      profileName: reviewCfg.profileName,
      overallPassed: true,
      blockingGate: { passed: true, results: gateResults },
      llm: {
        skipped: true,
        skipReason: 'REVIEW_SKIP_LLM',
        blocking: [],
        warnings: [],
        summaryMarkdown: '',
      },
    };
  }

  const maxChars = Number(process.env.REVIEW_RULES_MAX_CHARS ?? '120000');

  const orchDirs: string[] = [];
  if (targetUsesOrchestrationRulesOnly) {
    orchDirs.push(
      absoluteCustomerTargetAiRulesPath(deps.monorepoRoot, tidRaw),
    );
  }

  const bundle = await loadReviewRulesBundle({
    workspaceRoot: workspace,
    aiRulesGlob: reviewCfg.aiRulesGlob,
    customerRulesDir: reviewCfg.customerRulesDir,
    extraRelativeFiles: reviewCfg.extraConfigFiles ?? [],
    monorepoRoot: deps.monorepoRoot,
    orchestrationRuleDirs: orchDirs,
    workspaceRuleTreesSkipped: targetUsesOrchestrationRulesOnly,
    maxChars,
    logger: deps.logger,
  });

  const llmSlice = await runSemanticReview({
    llm: deps.llm,
    taskId: input.taskId,
    input,
    rulesBundle: bundle,
  });

  const semanticBlockingCount = llmSlice.skipped ? 0 : llmSlice.blocking.length;
  const overallPassed = gatePassed && semanticBlockingCount === 0;

  return {
    taskId: input.taskId,
    profileName: reviewCfg.profileName,
    overallPassed,
    blockingGate: { passed: true, results: gateResults },
    llm: llmSlice,
  };
};
