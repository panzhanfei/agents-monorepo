/** orchestrator → coding-agent：登记编码类说明（MVP 可为主读/占位，后续接真实改代码流水线）。 */
export interface ICodingRunRequest {
  readonly taskId: string;
  readonly instruction: string;
  /** 覆盖进程内默认路径；一般由编排器根据 `agents.config.yaml` 多目标或 env 解析为绝对路径。 */
  readonly workspacePath?: string;
}

export interface ICodingRunResponse {
  readonly taskId: string;
  readonly accepted: boolean;
  readonly summaryMarkdown: string;
  /** 运维可读说明，例如自动化尚未接入 */
  readonly note?: string;
}
