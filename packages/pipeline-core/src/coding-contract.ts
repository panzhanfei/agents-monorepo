/** orchestrator → coding-agent：编码请求（自检 + 工作区写入 / 新项目脚手架）。 */
export interface ICodingRunRequest {
  readonly taskId: string;
  readonly instruction: string;
  /** 覆盖进程内默认路径；一般由编排器根据 `agents.config.yaml` 多目标或 env 解析为绝对路径。 */
  readonly workspacePath?: string;
  /**
   * `greenfield`：目录可不存在，coding-agent 自检时会 `mkdir -p`。缺省或与 `existing`：目录须事先存在。
   * 一般由 `customer-targets/<id>/target.yaml` 的 `workspaceLifecycle` 透出。
   */
  readonly workspaceLifecycle?: 'existing' | 'greenfield';
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
  /** 自检实际采用的策略（缺省等价 `existing`） */
  readonly workspaceLifecycleApplied?: 'existing' | 'greenfield';
  /** `greenfield` 且曾为缺失路径时创建了目录则为 true */
  readonly greenfieldDirectoryCreated?: boolean;
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
  /**
   * 相对客户工作区根的路径（POSIX `/`）；不含成功前的阻断路径。
   * 用于飞书摘要与编排元数据。
   */
  readonly filesWritten?: readonly string[];
  /** 本次是否在「无工程清单」时落地了脚手架文件（仅需求文档不算） */
  readonly scaffoldApplied?: boolean;
  /** 写入阶段非阻断错误（仍有部分文件成功时也可能出现） */
  readonly applyWarnings?: readonly string[];
  /** 新项目下的技术栈选型（由需求启发式 + 可选 LLM 解析） */
  readonly stackChoice?: ICodingStackChoice;
}

/** coding-agent：需求驱动选型结果，回传给编排 / 飞书摘要 */
export interface ICodingStackChoice {
  readonly source: 'llm' | 'heuristic' | 'undetermined';
  /** 已选脚手架 id；`undetermined` 时通常为空 */
  readonly stackId?: string;
  /** 模型或规则给出的一行说明 */
  readonly rationale?: string;
  /** LLM 调用失败等非致命信息 */
  readonly llmNote?: string;
}