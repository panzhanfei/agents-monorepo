/** orchestrator → coding-agent：登记编码类说明（MVP 可为主读/占位，后续接真实改代码流水线）。 */
export interface ICodingRunRequest {
  readonly taskId: string;
  readonly instruction: string;
  /** 覆盖进程内默认路径；一般由编排器根据 `agents.config.yaml` 多目标或 env 解析为绝对路径。 */
  readonly workspacePath?: string;
  /**
   * 与 `target.projects[].id` 一致：**编码前自检**仅统计编排仓
   * `customer-targets/<customerTargetProjectId>/ai-rules/`（与审核侧一致）。
   */
  readonly customerTargetProjectId?: string;
}

export interface ICodingConfigBlockingIssue {
  readonly code: string;
  readonly remediation: string;
}

/** 编码前自检：目标项目仅以 Agent Console 上传的 ai-rules 为规则载体。 */
export interface ICodingRunConfigAssessment {
  readonly workspacePathResolved: string;
  readonly blockingIssues: readonly ICodingConfigBlockingIssue[];
  readonly reviewProfileUsed: string;
  /** 人读说明：`customer-targets/<id>/ai-rules（上传）` 等 */
  readonly aiRulesGlobUsed: string;
  /** 已不再从客户仓库扫 glob；目标项目仅用编排上传时为 0。 */
  readonly workspaceAiRuleFilesMatchedCount: number;
  /** `customer-targets/<id>/ai-rules` 下匹配的文本规则数 */
  readonly orchestrationAiRuleFilesMatchedCount: number;
  /** 编排侧命中数（与 workspace 无关）；为 0 时触发「建议确认」 */
  readonly aiRuleFilesMatchedCount: number;
  readonly suggestCustomerConfirmWithoutMatchedAiRules: boolean;
}

export interface ICodingRunResponse {
  readonly taskId: string;
  /** 若为 false：`blockingIssues` 已说明无法在客户项目安全执行编码流水线，或产品上要求先补齐/确认后再跑（见 assessment）。 */
  readonly accepted: boolean;
  readonly summaryMarkdown: string;
  /** 运维可读说明，例如自动化尚未接入 */
  readonly note?: string;
  /** 与工作区路径、agents 配置的只读自检（客户仓库下规则 glob 枚举等）。 */
  readonly configAssessment?: ICodingRunConfigAssessment;
}