export type PipelineStepKind =
  | 'lint'
  | 'typecheck'
  | 'test'
  | 'review_llm'
  | 'release'
  /** 全量测试与报告（由 test-agent 执行根配置命令） */
  | 'qa_full_suite'
  /** 打包与发布（由 ops-agent 执行） */
  | 'ops_publish'
  /** 一键：全量测试 → 构建 → 发包（编排组合，非单 Agent 专有） */
  | 'full_release'
  /** 产品需求分析（结构化 PRD / 验收标准，由 requirements-agent） */
  | 'requirements_analysis';

export interface IPipelineStep {
  readonly kind: PipelineStepKind;
}

/** Placeholder tag for scaffold builds; replace when versioning pipeline-core. */
export const PIPELINE_CORE_SCAFFOLD = '0.0.0-scaffold';

export type {
  ICreateTaskInput,
  IFindActiveTaskQuery,
  ITaskRecord,
  ITaskStore,
  IUpdateTaskPatch,
  TaskStatus,
} from './task-store.js';
export {
  ACTIVE_TASK_STATUSES,
  isActiveTaskStatus,
} from './task-store.js';

export type {
  BackendStackProfile,
  FrontendStackProfile,
  ImplementationRole,
  ITargetStackTarget,
  StackProfile,
} from './runtime-skills.js';
export {
  BACKEND_STACK_PROFILES,
  FRONTEND_STACK_PROFILES,
  isBackendStackProfile,
  isFrontendStackProfile,
  isValidTargetStackTarget,
} from './runtime-skills.js';

export type {
  IRequirementsAnalysisRequest,
  IRequirementsAnalysisResponse,
  RequirementsPrdStatus,
} from './requirements-contract.js';

export type {
  ICodingConfigBlockingIssue,
  ICodingRunConfigAssessment,
  ICodingRunRequest,
  ICodingRunResponse,
} from './coding-contract.js';

export type {
  IReviewFinding,
  IReviewGateCommandResult,
  IReviewLlmSlice,
  IReviewRunRequest,
  IReviewRunResponse,
  ReviewFindingSeverity,
} from './review-contract.js';

export type {
  ITestRunRequest,
  ITestRunResponse,
} from './test-contract.js';
