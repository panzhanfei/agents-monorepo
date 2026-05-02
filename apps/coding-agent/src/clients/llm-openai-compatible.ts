import type { ICodingLlmEnvConfig } from '../config/llm-env.js';

export type ILlmChatMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

type IOpenAiChatResponse = {
  choices?: ReadonlyArray<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/$/, '');

export class LlmTransportError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'LlmTransportError';
    this.statusCode = statusCode;
  }
}

export const chatCompletionText = async (
  cfg: ICodingLlmEnvConfig,
  messages: readonly ILlmChatMessage[]
): Promise<string> => {
  const url = `${normalizeBaseUrl(cfg.baseUrl)}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, cfg.timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cfg.apiKey.trim() !== '') {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  try {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: 0.15,
        }),
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new LlmTransportError(`请求超时（${String(cfg.timeoutMs)}ms）`);
      }
      throw e;
    }

    const raw = (await res.json()) as IOpenAiChatResponse;
    if (!res.ok) {
      const detail =
        raw.error?.message ?? `HTTP ${String(res.status)} ${res.statusText}`;
      throw new LlmTransportError(detail, res.status);
    }

    const text = raw.choices?.[0]?.message?.content?.trim();
    if (text === undefined || text === '') {
      throw new LlmTransportError('模型返回空内容');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
};
