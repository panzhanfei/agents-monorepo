import type { ImplementationRole, StackProfile } from './runtime-skills.js';

export interface ITestRunRequest {
  readonly taskId: string;
  readonly workspacePath?: string;
  /** 多目标：来自目标定义文件的「全量测试命令」，优先于 PIPELINE_FULL_TEST_COMMAND / agents.config pipeline */
  readonly fullTestCommand?: string;
  readonly implementationRole?: ImplementationRole;
  readonly stackProfile?: StackProfile;
}

export interface ITestRunResponse {
  readonly taskId: string;
  readonly passed: boolean;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly command: string;
  readonly durationMs: number;
  readonly stdoutTail: string;
  readonly stderrTail: string;
}
