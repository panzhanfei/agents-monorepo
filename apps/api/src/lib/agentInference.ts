import type {
  IAgentInferenceMode,
  IAgentInferencePublic,
} from "@agents/shared-types";

export type StoredAgentInference = {
  mode: IAgentInferenceMode;
  baseUrl: string | null;
  hostedProvider: string | null;
  apiKey: string | null;
};

const clampTrim = (s: string, max: number): string | null => {
  const t = s.trim().slice(0, max);
  return t.length === 0 ? null : t;
};

/** 写入 DB / 服务端内部流转；不包含对外 DTO（apiKey 为敏感字段）。 */
export const parseInferenceStored = (raw: unknown): StoredAgentInference => {
  const empty: StoredAgentInference = {
    mode: "local",
    baseUrl: null,
    hostedProvider: null,
    apiKey: null,
  };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return empty;

  const o = raw as Record<string, unknown>;
  const mode: IAgentInferenceMode = o.mode === "hosted" ? "hosted" : "local";

  const readNullable = (v: unknown, max: number): string | null => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return null;
    return clampTrim(v, max);
  };

  let apiKey: string | null = null;
  if (typeof o.apiKey === "string") {
    const t = o.apiKey.trim().slice(0, 8192);
    apiKey = t.length === 0 ? null : t;
  }

  return {
    mode,
    baseUrl: readNullable(o.baseUrl, 2048),
    hostedProvider: readNullable(o.hostedProvider, 64),
    apiKey,
  };
};

export const toAgentInferencePublic = (raw: unknown): IAgentInferencePublic => {
  const s = parseInferenceStored(raw);
  return {
    mode: s.mode,
    baseUrl: s.baseUrl,
    hostedProvider: s.hostedProvider,
    apiKeyConfigured: Boolean(s.apiKey?.length),
  };
};

/** PATCH 语义：不传 optional 字段则沿用旧值（apiKey 除外：仅在 PATCH 字面量包含 apiKey 时更新）。 */
export const mergeAgentInferenceStored = (
  existingRaw: unknown,
  patch: {
    mode: IAgentInferenceMode;
    baseUrl?: string | null;
    hostedProvider?: string | null;
    apiKey?: string | null;
  },
): StoredAgentInference => {
  const prev = parseInferenceStored(existingRaw);

  if (patch.mode === "local") {
    const baseUrl =
      patch.baseUrl === undefined ? prev.baseUrl : patch.baseUrl === null ? null : clampTrim(patch.baseUrl, 2048);
    return { mode: "local", baseUrl, hostedProvider: null, apiKey: null };
  }

  const baseUrl =
    patch.baseUrl === undefined ? prev.baseUrl : patch.baseUrl === null ? null : clampTrim(patch.baseUrl, 2048);
  const hostedProvider =
    patch.hostedProvider === undefined
      ? prev.hostedProvider
      : patch.hostedProvider === null
        ? null
        : clampTrim(patch.hostedProvider, 64);

  let apiKey = prev.apiKey;
  if (patch.apiKey !== undefined) {
    apiKey =
      patch.apiKey === null || patch.apiKey === ""
        ? null
        : clampTrim(patch.apiKey, 8192);
  }

  return { mode: "hosted", baseUrl, hostedProvider, apiKey };
};

export const inferenceStoredToJson = (s: StoredAgentInference): Record<string, unknown> => ({
  mode: s.mode,
  baseUrl: s.baseUrl,
  hostedProvider: s.hostedProvider,
  ...(s.apiKey ? { apiKey: s.apiKey } : {}),
});
