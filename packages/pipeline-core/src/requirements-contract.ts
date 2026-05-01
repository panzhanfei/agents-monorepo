import type { ITargetStackTarget } from './runtime-skills.js';

/**
 * Orchestrator ↔ requirements-agent HTTP 契约（请求/响应体）。
 */

export type RequirementsPrdStatus = 'draft' | 'ready_for_implementation';

export interface IRequirementsAnalysisRequest {
  readonly taskId: string;
  /** 用户原始需求描述 */
  readonly rawRequirement: string;
  /** 可选：PRD 应对齐的栈与实现面 */
  readonly targetStackTargets?: readonly ITargetStackTarget[];
}

export interface IRequirementsAnalysisResponse {
  readonly taskId: string;
  readonly markdown: string;
  readonly prdStatus: RequirementsPrdStatus;
}
