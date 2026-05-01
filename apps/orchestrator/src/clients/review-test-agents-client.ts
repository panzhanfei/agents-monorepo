import type {
  IReviewRunRequest,
  IReviewRunResponse,
  ITestRunRequest,
  ITestRunResponse,
} from '@agents/pipeline-core';

export const getReviewAgentBaseUrl = (): string =>
  process.env.REVIEW_AGENT_BASE_URL?.trim() ?? 'http://127.0.0.1:4030';

export const runReviewHttp = async (
  body: IReviewRunRequest,
  options?: { timeoutMs?: number }
): Promise<IReviewRunResponse> => {
  const base = getReviewAgentBaseUrl().replace(/\/$/, '');
  const timeoutMs =
    options?.timeoutMs ??
    Number(process.env.REVIEW_AGENT_HTTP_TIMEOUT_MS ?? '900000');

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const token = process.env.REVIEW_AGENT_INTERNAL_TOKEN?.trim();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token !== undefined && token !== '') {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}/v1/review/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      throw new Error(
        typeof json.message === 'string'
          ? json.message
          : `review-agent HTTP ${String(res.status)}`
      );
    }

    if (
      typeof json.taskId !== 'string' ||
      typeof json.profileName !== 'string' ||
      typeof json.overallPassed !== 'boolean' ||
      json.blockingGate === undefined ||
      json.llm === undefined
    ) {
      throw new Error('review-agent 响应缺少必填字段');
    }

    return json as unknown as IReviewRunResponse;
  } finally {
    clearTimeout(timer);
  }
};

export const getTestAgentBaseUrl = (): string =>
  process.env.TEST_AGENT_BASE_URL?.trim() ?? 'http://127.0.0.1:4040';

export const runTestHttp = async (
  body: ITestRunRequest,
  options?: { timeoutMs?: number }
): Promise<ITestRunResponse> => {
  const base = getTestAgentBaseUrl().replace(/\/$/, '');
  const timeoutMs =
    options?.timeoutMs ??
    Number(process.env.TEST_AGENT_HTTP_TIMEOUT_MS ?? '7200000');

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const token = process.env.TEST_AGENT_INTERNAL_TOKEN?.trim();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token !== undefined && token !== '') {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}/v1/test/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      throw new Error(
        typeof json.message === 'string'
          ? json.message
          : `test-agent HTTP ${String(res.status)}`
      );
    }

    if (
      typeof json.taskId !== 'string' ||
      typeof json.passed !== 'boolean' ||
      typeof json.command !== 'string'
    ) {
      throw new Error('test-agent 响应缺少必填字段');
    }

    return json as unknown as ITestRunResponse;
  } finally {
    clearTimeout(timer);
  }
};
