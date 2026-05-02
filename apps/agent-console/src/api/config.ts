import { browserLogger } from '~/logging';

export type IConfigEnvelope = {
  ok: boolean;
  yamlPath?: string;
  yamlRaw?: string;
  parsedUnknown?: { target?: unknown };
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
  const json = (await res.json()) as IConfigEnvelope;

  if (!res.ok || json.ok !== true) {
    throw new ConfigFetchError(`读取配置失败 ${String(res.status)}`, res.status);
  }

  if (json.yamlRaw === undefined || json.yamlPath === undefined) {
    throw new ConfigFetchError('接口未返回 yaml 内容', res.status);
  }

  return json;
};
