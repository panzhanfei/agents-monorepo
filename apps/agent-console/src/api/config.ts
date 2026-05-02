import { browserLogger } from '~/logging';

export type IConfigEnvelope = {
  ok: boolean;
  yamlPath?: string;
  yamlRaw?: string;
  parsedUnknown?: { target?: unknown };
  parsedHydrated?: { target?: unknown };
};

export class ConfigFetchError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = 'ConfigFetchError';
    this.status = status;
  }
}

export const fetchConfigEnvelope = async (): Promise<IConfigEnvelope> => {
  browserLogger.debug('GET /api/config');
  const res = await fetch('/api/config');
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ConfigFetchError(
      `读取配置失败 ${String(res.status)}（响应非 JSON）`,
      res.status,
    );
  }

  if (!res.ok || json.ok !== true) {
    const hint =
      typeof json.message === 'string' && json.message !== ''
        ? json.message
        : '';
    throw new ConfigFetchError(
      hint !== ''
        ? `${hint}（HTTP ${String(res.status)}）`
        : `读取配置失败 ${String(res.status)}`,
      res.status,
    );
  }

  const env = json as IConfigEnvelope;

  if (env.yamlRaw === undefined || env.yamlPath === undefined) {
    throw new ConfigFetchError('接口未返回 yaml 内容', res.status);
  }

  return env;
};
