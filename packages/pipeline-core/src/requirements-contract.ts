import type { ITargetStackTarget } from './runtime-skills.js';

/**
 * Orchestrator ↔ requirements-agent HTTP 契约（请求/响应体）。
 */

export type RequirementsPrdStatus = 'draft' | 'ready_for_implementation';

/** 与 OpenAI 兼容接口的 vision 入参一致：`data:<mime>;base64,<…>` */
export interface IRequirementsImageAttachment {
  readonly mimeType: string;
  readonly base64: string;
}

export interface IRequirementsAnalysisRequest {
  readonly taskId: string;
  /**
   * create：仅从 rawRequirement 起稿；
   * revise：必须提供 priorPrdMarkdown，模型的输出应为「合并后的完整 PRD」。
   */
  readonly mode?: 'create' | 'revise';
  /** 可选：上一轮 requirements 产出的 Markdown 正文（仅在 revise） */
  readonly priorPrdMarkdown?: string;
  /** 用户原始需求描述 */
  readonly rawRequirement: string;
  /** 可选：截图/扫描件等（需使用支持视觉的多模态模型） */
  readonly imageAttachments?: readonly IRequirementsImageAttachment[];
  /** 可选：PRD 应对齐的栈与实现面 */
  readonly targetStackTargets?: readonly ITargetStackTarget[];
}

export interface IRequirementsAnalysisResponse {
  readonly taskId: string;
  readonly markdown: string;
  readonly prdStatus: RequirementsPrdStatus;
}
