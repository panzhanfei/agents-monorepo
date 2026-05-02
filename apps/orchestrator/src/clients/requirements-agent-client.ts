import type {
  IRequirementsAnalysisRequest,
  IRequirementsAnalysisResponse,
} from '@agents/pipeline-core';

import { resolveAgentHttpBaseUrlFromEnv } from './agent-http-base-url.js';

export const getRequirementsAgentBaseUrl = (): string =>
  resolveAgentHttpBaseUrlFromEnv({
    explicitBaseUrlEnv: process.env.REQUIREMENTS_AGENT_BASE_URL,
    portEnv: process.env.REQUIREMENTS_AGENT_PORT,
    portDefault: 4060,
  });

export const analyzeRequirementsHttp = async (
  body: IRequirementsAnalysisRequest,
  options?: { timeoutMs?: number }
): Promise<IRequirementsAnalysisResponse> => {
  const base = getRequirementsAgentBaseUrl().replace(/\/$/, '');
  const timeoutMs =
    options?.timeoutMs ??
    Number(process.env.REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS ?? '180000');

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const token = process.env.REQUIREMENTS_AGENT_INTERNAL_TOKEN?.trim();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token !== undefined && token !== '') {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}/v1/requirements/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as {
      ok?: boolean;
      taskId?: string;
      markdown?: string;
      prdStatus?: string;
      message?: string;
      code?: string;
    };

    if (!res.ok) {
      throw new Error(json.message ?? `requirements-agent HTTP ${String(res.status)}`);
    }

    if (
      json.markdown === undefined ||
      json.taskId === undefined ||
      json.prdStatus === undefined
    ) {
      throw new Error('requirements-agent 响应缺少 markdown/taskId/prdStatus');
    }

    return {
      taskId: json.taskId,
      markdown: json.markdown,
      prdStatus:
        json.prdStatus === 'ready_for_implementation'
          ? 'ready_for_implementation'
          : 'draft',
    };
  } finally {
    clearTimeout(timer);
  }
};
