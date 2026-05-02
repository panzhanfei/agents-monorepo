import fs from 'node:fs/promises';
import type { ILogger } from '@agents/logger';
import type { ITestRunRequest, ITestRunResponse } from '@agents/pipeline-core';
import {
  loadAgentsConfig,
  resolveFullTestCommand,
  resolveWorkspacePath,
  runShellCommand,
} from '@agents/agents-config';

export type IRunTestSuiteDeps = {
  readonly logger: ILogger;
  readonly monorepoRoot: string;
};

export const runFullTestSuite = async (
  input: ITestRunRequest,
  deps: IRunTestSuiteDeps
): Promise<ITestRunResponse> => {
  const workspace = resolveWorkspacePath(deps.monorepoRoot, input.workspacePath);
  await fs.access(workspace).catch(() => {
    throw new Error(`工作区不存在或不可访问：${workspace}`);
  });

  const cfg = await loadAgentsConfig({ monorepoRoot: deps.monorepoRoot });
  const command = resolveFullTestCommand(
    cfg,
    process.env,
    input.fullTestCommand
  );
  const yamlTimeoutRaw = (
    cfg.pipeline as unknown as {
      readonly testGateTimeoutMs?: unknown;
    }
  ).testGateTimeoutMs;
  const yamlTimeout =
    typeof yamlTimeoutRaw === 'number' &&
    Number.isFinite(yamlTimeoutRaw) &&
    yamlTimeoutRaw > 0
      ? yamlTimeoutRaw
      : undefined;
  const envGate = process.env.TEST_GATE_TIMEOUT_MS?.trim() ?? '';
  const timeoutMs =
    envGate !== ''
      ? Number(envGate)
      : yamlTimeout !== undefined
        ? yamlTimeout
        : 3_600_000;

  const started = Date.now();
  deps.logger.info('test_suite_start', {
    taskId: input.taskId,
    command,
    workspace,
  });

  const r = await runShellCommand({
    cwd: workspace,
    script: command,
    timeoutMs,
  });
  const durationMs = Date.now() - started;
  const passed = !r.timedOut && r.exitCode === 0;

  deps.logger.info('test_suite_done', {
    taskId: input.taskId,
    passed,
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    durationMs,
  });

  return {
    taskId: input.taskId,
    passed,
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    command,
    durationMs,
    stdoutTail: r.stdout,
    stderrTail: r.stderr,
  };
};
