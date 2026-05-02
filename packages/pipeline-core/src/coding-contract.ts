/** orchestrator → coding-agent：登记编码类说明（MVP 可为主读/占位，后续接真实改代码流水线）。 */
export interface ICodingRunRequest {
  readonly taskId: string;
  readonly instruction: string;
  /** 覆盖进程内默认路径；一般由编排器根据 `agents.config.yaml` 多目标或 env 解析为绝对路径。 */
  readonly workspacePath?: string;
}

export interface ICodingConfigBlockingIssue {
  readonly code: string;
  readonly remediation: string;
}

/** 与工作区、`agents.config` 审核同源 AI 规则 glob 的一致性自检摘要，供编排器与飞书展示。 */
export interface ICodingRunConfigAssessment {
  readonly workspacePathResolved: string;
  readonly blockingIssues: readonly ICodingConfigBlockingIssue[];
  readonly reviewProfileUsed: string;
  readonly aiRulesGlobUsed: string;
  readonly aiRuleFilesMatchedCount: number;
  /**
   * **未阻断**但通过 glob 在项目目录未匹配到任何 AI 规则文件时置位；产品上宜由飞书向客户确认再继续全自动改代码。
   */
  readonly suggestCustomerConfirmWithoutMatchedAiRules: boolean;
}

export interface ICodingRunResponse {
  readonly taskId: string;
  /** 若为 false：`blockingIssues` 已说明无法在客户项目安全执行编码流水线，或产品上要求先补齐/确认后再跑（见 assessment）。 */
  readonly accepted: boolean;
  readonly summaryMarkdown: string;
  /** 运维可读说明，例如自动化尚未接入 */
  readonly note?: string;
  /** 与工作区路径、AIRule glob、编排仓 agents 配置的只读自检结果（与 MCP/Cursor Skill 文件名无关，指客户仓库下规则文件的 glob 枚举）。 */
  readonly configAssessment?: ICodingRunConfigAssessment;
}
