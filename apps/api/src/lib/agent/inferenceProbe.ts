import type { IAuthInferenceTestResponse } from "@agents/shared-types";
import { AgentInferenceMode } from "@prisma/client";

const PROBE_TIMEOUT_MS = 10_000;
const DEFAULT_HOSTED_V1_BASE = "https://api.openai.com/v1";

export type IInferenceProbeInput = {
  inferenceMode: AgentInferenceMode;
  baseUrl: string | null;
  apiKey: string | null;
  modelHint?: string | null;
};

const trimModelHint = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  const colon = t.indexOf(":");
  if (colon > 0 && colon < 48) {
    const rest = t.slice(colon + 1).trim();
    return rest.length > 0 ? rest : t;
  }
  return t;
};

const normalizeOllamaOrigin = (raw: string): string | null => {
  try {
    let s = raw.trim();
    if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
    return new URL(s).origin;
  } catch {
    return null;
  }
};

const openAiV1BaseFromInput = (raw: string | null | undefined): string | null => {
  const fallback = DEFAULT_HOSTED_V1_BASE;
  const source = raw?.trim() ? raw.trim() : fallback;
  try {
    let s = source;
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    const u = new URL(s);
    let path = u.pathname.replace(/\/$/, "");
    if (!path.endsWith("/v1")) {
      if (path === "" || path === "/") path = "/v1";
      else path = `${path}/v1`;
    }
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
};

type IOllamaTagsResult =
  | { ok: true; names: string[] }
  | { ok: false; err: string };

const tryOllamaTags = async (origin: string): Promise<IOllamaTagsResult> => {
  const url = `${origin.replace(/\/$/, "")}/api/tags`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, err: `HTTP ${String(res.status)}` };
    const json = (await res.json()) as { models?: { name?: string }[] };
    const names = (json.models ?? []).map((m) => (typeof m.name === "string" ? m.name : "")).filter(Boolean);
    return { ok: true, names };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, err: msg };
  }
};

type IOpenAiModelsResult =
  | { ok: true; ids: string[] }
  | { ok: false; err: string };

const tryOpenAiCompatibleModels = async (v1Base: string, apiKey: string): Promise<IOpenAiModelsResult> => {
  const url = `${v1Base.replace(/\/$/, "")}/models`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) return { ok: false, err: `HTTP ${String(res.status)}` };
    const json = (await res.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((m) => (typeof m.id === "string" ? m.id : "")).filter(Boolean);
    return { ok: true, ids };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, err: msg };
  }
};

const ollamaNameMatchesHint = (name: string, hintLower: string): boolean => {
  const low = name.toLowerCase();
  if (low === hintLower) return true;
  const base = low.split(":")[0] ?? "";
  if (base === hintLower) return true;
  return low.endsWith(`:${hintLower}`);
};

export const runInferenceProbe = async (input: IInferenceProbeInput): Promise<IAuthInferenceTestResponse> => {
  const modelHint = trimModelHint(input.modelHint ?? null);

  if (input.inferenceMode === AgentInferenceMode.local) {
    const raw = input.baseUrl?.trim();
    if (!raw) {
      return {
        ok: false,
        probe: "skipped",
        message: "本地模式需要先在「推理连接」中填写 Base URL（如 http://127.0.0.1:11434）。",
      };
    }
    const origin = normalizeOllamaOrigin(raw);
    if (!origin) {
      return { ok: false, probe: "skipped", message: "Base URL 格式无效。" };
    }
    const ollama = await tryOllamaTags(origin);
    if (!ollama.ok) {
      return {
        ok: false,
        probe: "ollama_tags",
        message: `无法访问 Ollama 风格接口 /api/tags（${ollama.err}）。请确认服务已启动且地址正确。`,
      };
    }
    if (modelHint) {
      const h = modelHint.toLowerCase();
      const hit = ollama.names.some((n) => ollamaNameMatchesHint(n, h));
      if (!hit) {
        return {
          ok: false,
          probe: "ollama_tags",
          message: `网关已通，但未在已安装模型列表中找到「${modelHint}」。可检查名称或执行 ollama pull。`,
        };
      }
    }
    return {
      ok: true,
      probe: "ollama_tags",
      message: modelHint
        ? `已连通本地网关，并匹配到模型「${modelHint}」。`
        : `已连通本地网关（GET /api/tags），当前约 ${String(ollama.names.length)} 个模型条目。`,
    };
  }

  const key = input.apiKey?.trim();
  if (!key) {
    return {
      ok: false,
      probe: "skipped",
      message:
        "线上模式需要先保存 API Key。若使用本地 OpenAI 兼容网关且无密钥，请改用「本地 / 自建网关」模式。",
    };
  }

  const v1Base = openAiV1BaseFromInput(input.baseUrl);
  if (!v1Base) {
    return { ok: false, probe: "skipped", message: "Base URL 格式无效。" };
  }

  const openai = await tryOpenAiCompatibleModels(v1Base, key);
  if (!openai.ok) {
    return {
      ok: false,
      probe: "openai_models",
      message: `无法访问 OpenAI 兼容接口 GET /v1/models（${openai.err}）。请检查 Base URL、密钥与网络。`,
    };
  }

  if (modelHint) {
    const hit = openai.ids.some((id) => id === modelHint);
    if (!hit) {
      return {
        ok: false,
        probe: "openai_models",
        message: `网关已通，但在当前密钥可见的模型列表中未找到「${modelHint}」。`,
      };
    }
  }

  return {
    ok: true,
    probe: "openai_models",
    message: modelHint
      ? `已连通线上接口，并找到模型「${modelHint}」。`
      : `已连通线上 OpenAI 兼容接口，模型列表约 ${String(openai.ids.length)} 条。`,
  };
};
