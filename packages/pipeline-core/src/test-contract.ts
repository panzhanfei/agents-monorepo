import type { ImplementationRole, StackProfile } from './runtime-skills.js';

export interface ITestRunRequest {
  readonly taskId: string;
  readonly workspacePath?: string;
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
