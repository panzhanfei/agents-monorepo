import type { ImplementationRole, StackProfile } from './runtime-skills.js';

export type ReviewFindingSeverity = 'blocking' | 'warning';

export interface IReviewFinding {
  readonly rule?: string;
  readonly message: string;
  readonly severity: ReviewFindingSeverity;
}

export interface IReviewGateCommandResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly stdoutTail: string;
  readonly stderrTail: string;
}

export interface IReviewRunRequest {
  readonly taskId: string;
  /** 覆盖默认 TARGET_WORKSPACE_PATH（相对路径相对于 monorepo 根解析） */
  readonly workspacePath?: string;
  readonly implementationRole?: ImplementationRole;
  readonly stackProfile?: StackProfile;
  /** 供模型理解的变更摘要（可选） */
  readonly changeSummary?: string;
  /** 可选 unified diff 片段（过大时请摘要） */
  readonly diffText?: string;
}

export interface IReviewLlmSlice {
  readonly skipped: boolean;
  readonly skipReason?: string;
  readonly blocking: readonly IReviewFinding[];
  readonly warnings: readonly IReviewFinding[];
  readonly summaryMarkdown: string;
}

export interface IReviewRunResponse {
  readonly taskId: string;
  readonly profileName: string;
  /** blocking 门禁脚本通过且 LLM 未输出语义 blocking 时为 true（LLM 跳过时不据此失败） */
  readonly overallPassed: boolean;
  readonly blockingGate: {
    readonly passed: boolean;
    readonly results: readonly IReviewGateCommandResult[];
  };
  readonly llm: IReviewLlmSlice;
}
