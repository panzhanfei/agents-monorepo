/**
 * 与 review-agent 对齐：OpenAI 兼容 Chat Completions（Ollama / vLLM / 云 API）。
 * 用于 **技术栈选型**；不配置 model 时跳过 LLM，仅用需求关键词启发式。
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
