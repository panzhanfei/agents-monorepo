import type {
  ICodingRunRequest,
  ICodingRunResponse,
  ICodingRunConfigAssessment,
} from '@agents/pipeline-core';

import { resolveAgentHttpBaseUrlFromEnv } from './agent-http-base-url.js';

export const getCodingAgentBaseUrl = (): string =>
  resolveAgentHttpBaseUrlFromEnv({
    explicitBaseUrlEnv: process.env.CODING_AGENT_BASE_URL,
    portEnv: process.env.CODING_AGENT_PORT,
    portDefault: 4020,
  });

export const runCodingHttp = async (
  body: ICodingRunRequest,
  options?: { timeoutMs?: number }
): Promise<ICodingRunResponse> => {
  const base = getCodingAgentBaseUrl().replace(/\/$/, '');
  const timeoutMs =
    options?.timeoutMs ??
    Number(process.env.CODING_AGENT_HTTP_TIMEOUT_MS ?? '120000');

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const token = process.env.CODING_AGENT_INTERNAL_TOKEN?.trim();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token !== undefined && token !== '') {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}/v1/coding/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as {
      ok?: boolean;
      taskId?: string;
      accepted?: boolean;
      summaryMarkdown?: string;
      note?: string;
      message?: string;
      configAssessment?: ICodingRunConfigAssessment;
    };

    if (!res.ok) {
      throw new Error(json.message ?? `coding-agent HTTP ${String(res.status)}`);
    }

    if (
      json.taskId === undefined ||
      json.accepted === undefined ||
      json.summaryMarkdown === undefined
    ) {
      throw new Error('coding-agent 响应缺少 taskId/accepted/summaryMarkdown');
    }

    return {
      taskId: json.taskId,
      accepted: json.accepted,
      summaryMarkdown: json.summaryMarkdown,
      ...(json.note !== undefined ? { note: json.note } : {}),
      ...(json.configAssessment !== undefined
        ? { configAssessment: json.configAssessment }
        : {}),
    };
  } finally {
    clearTimeout(timer);
  }
};
