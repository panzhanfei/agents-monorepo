/**
 * 与 review-agent 对齐：OpenAI 兼容 Chat Completions（Ollama / vLLM / 云 API）。
 * 启用时由 **`trySynthesizeFilesFromInstruction`** 按任务正文生成实现代码围栏。
 * 未配置 model / baseUrl 或显式关闭 `CODING_STACK_LLM` 时跳过实现 LLM（无手填围栏则通常仅写入需求文档）。
 */
export type ICodingLlmEnvConfig = {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
};

export const getCodingLlmEnvConfig = (): ICodingLlmEnvConfig => {
  const modelSpecific = process.env.CODING_STACK_LLM_MODEL?.trim();
  const fallback = process.env.LLM_MODEL?.trim() ?? '';
  const model =
    modelSpecific !== undefined && modelSpecific !== ''
      ? modelSpecific
      : fallback;

  return {
    baseUrl: process.env.LLM_BASE_URL ?? 'http://127.0.0.1:11434/v1',
    model,
    apiKey: process.env.LLM_API_KEY ?? '',
    timeoutMs: Number(
      process.env.CODING_STACK_LLM_TIMEOUT_MS ??
        process.env.LLM_TIMEOUT_MS ??
        '90000'
    ),
  };
};

export const isCodingStackLlmEnabled = (): boolean => {
  const v = process.env.CODING_STACK_LLM?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') {
    return false;
  }
  const cfg = getCodingLlmEnvConfig();
  return cfg.model !== '' && cfg.baseUrl.trim() !== '';
};
