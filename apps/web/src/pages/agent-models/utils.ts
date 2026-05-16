import type { IAgentSlotKey, IAgentSlotPublic, IAuthPatchAgentSlotBody } from "@agents/shared-types";
import { AGENT_SLOT_KEYS } from "@agents/shared-types";
import type { ISlotDraft } from "./interface";

export const AGENT_MODELS_SLOT_META: readonly { key: IAgentSlotKey; label: string }[] = [
  { key: "router", label: "入口路由" },
  { key: "analyst", label: "需求分析" },
  { key: "architect", label: "架构设计" },
  { key: "coder", label: "编码实现" },
  { key: "reviewer", label: "代码评审" },
  { key: "verifier", label: "验证（测试 / CI）" },
  { key: "ops", label: "构建与发布" },
];

export const emptyAgentSlotDraft = (): ISlotDraft => ({
  mode: "local",
  local: { baseUrl: "", model: "" },
  hosted: {
    baseUrl: "",
    model: "",
    hostedProvider: "",
    apiKeyDraft: "",
    clearApiKey: false,
  },
});

export const initialAgentDraftRecord = (): Record<IAgentSlotKey, ISlotDraft> => {
  const o = {} as Record<IAgentSlotKey, ISlotDraft>;
  for (const k of AGENT_SLOT_KEYS) o[k] = emptyAgentSlotDraft();
  return o;
};

export const agentDraftsEqual = (a: ISlotDraft, b: ISlotDraft): boolean =>
  a.mode === b.mode &&
  a.local.baseUrl === b.local.baseUrl &&
  a.local.model === b.local.model &&
  a.hosted.baseUrl === b.hosted.baseUrl &&
  a.hosted.model === b.hosted.model &&
  a.hosted.hostedProvider === b.hosted.hostedProvider &&
  a.hosted.apiKeyDraft === b.hosted.apiKeyDraft &&
  a.hosted.clearApiKey === b.hosted.clearApiKey;

/** `model` 为空时表示删除该槽配置；否则返回写入体。 */
export const patchBodyFromAgentDraft = (d: ISlotDraft): IAuthPatchAgentSlotBody | null => {
  if (d.mode === "local") {
    if (!d.local.model.trim()) return null;
    const baseTrim = d.local.baseUrl.trim();
    const baseUrlVal = baseTrim === "" ? null : baseTrim;
    return { mode: "local", model: d.local.model.trim(), baseUrl: baseUrlVal };
  }
  if (!d.hosted.model.trim()) return null;
  const baseTrim = d.hosted.baseUrl.trim();
  const baseUrlVal = baseTrim === "" ? null : baseTrim;
  const hp = d.hosted.hostedProvider.trim();
  return {
    mode: "hosted",
    model: d.hosted.model.trim(),
    baseUrl: baseUrlVal,
    hostedProvider: hp === "" ? null : hp,
    ...(d.hosted.clearApiKey
      ? { apiKey: null }
      : d.hosted.apiKeyDraft.trim()
        ? { apiKey: d.hosted.apiKeyDraft.trim() }
        : {}),
  };
};

export const validateAgentSlotBeforeSave = (
  d: ISlotDraft,
  serverSlot: IAgentSlotPublic | undefined,
): string | null => {
  if (d.mode !== "hosted") return null;
  if (!d.hosted.model.trim()) return null;
  const hasStoredKey = Boolean(serverSlot?.apiKeyConfigured);
  const typedKey = d.hosted.apiKeyDraft.trim().length > 0;
  if (!hasStoredKey && !typedKey && !d.hosted.clearApiKey) {
    return "线上模式需提供 API Key（必填 · 当前尚无已存密钥）";
  }
  return null;
};

export const draftFromServerAgentSlots = (
  agentSlots: Record<IAgentSlotKey, IAgentSlotPublic>,
): Record<IAgentSlotKey, ISlotDraft> => {
  const next = initialAgentDraftRecord();
  for (const k of AGENT_SLOT_KEYS) {
    const s = agentSlots[k];
    if (s.mode === "local") {
      next[k] = {
        mode: "local",
        local: { baseUrl: s.baseUrl ?? "", model: s.model },
        hosted: {
          baseUrl: "",
          model: "",
          hostedProvider: "",
          apiKeyDraft: "",
          clearApiKey: false,
        },
      };
    } else {
      next[k] = {
        mode: "hosted",
        local: { baseUrl: "", model: "" },
        hosted: {
          baseUrl: s.baseUrl ?? "",
          model: s.model,
          hostedProvider: s.hostedProvider ?? "",
          apiKeyDraft: "",
          clearApiKey: false,
        },
      };
    }
  }
  return next;
};

export const mergeAgentSlotDraft = (
  prev: Record<IAgentSlotKey, ISlotDraft>,
  key: IAgentSlotKey,
  partial: Partial<ISlotDraft>,
): Record<IAgentSlotKey, ISlotDraft> => {
  const cur = prev[key];
  const merged: ISlotDraft = {
    ...cur,
    ...partial,
    local: partial.local ? { ...cur.local, ...partial.local } : cur.local,
    hosted: partial.hosted ? { ...cur.hosted, ...partial.hosted } : cur.hosted,
  };
  return { ...prev, [key]: merged };
};
