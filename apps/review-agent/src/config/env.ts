export const getListenPort = (): number =>
  Number(process.env.REVIEW_AGENT_PORT ?? process.env.PORT ?? '4030');

export type ILlmEnvConfig = {
  readonly provider: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
};

export const getLlmEnvConfig = (): ILlmEnvConfig => {
  const modelSpecific = process.env.REVIEW_LLM_MODEL?.trim();
  const fallback = process.env.LLM_MODEL ?? '';
  return {
    provider: process.env.LLM_PROVIDER ?? 'local',
    baseUrl: process.env.LLM_BASE_URL ?? 'http://127.0.0.1:11434/v1',
    model:
      modelSpecific !== undefined && modelSpecific !== ''
        ? modelSpecific
        : fallback,
    apiKey: process.env.LLM_API_KEY ?? '',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? '120000'),
    maxRetries: Math.min(
      Math.max(Number(process.env.REVIEW_LLM_MAX_RETRIES ?? '2'), 0),
      5
    ),
  };
};

export const getReviewAgentInternalToken = (): string | undefined => {
  const t = process.env.REVIEW_AGENT_INTERNAL_TOKEN?.trim();
  return t === '' ? undefined : t;
};
