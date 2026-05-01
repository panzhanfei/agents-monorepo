/** orchestrator → coding-agent：登记编码类说明（MVP 可为主读/占位，后续接真实改代码流水线）。 */
export interface ICodingRunRequest {
  readonly taskId: string;
  readonly instruction: string;
}

export interface ICodingRunResponse {
  readonly taskId: string;
  readonly accepted: boolean;
  readonly summaryMarkdown: string;
  /** 运维可读说明，例如自动化尚未接入 */
  readonly note?: string;
}
