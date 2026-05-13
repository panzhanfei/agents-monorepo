export const AGENT_SLOT_KEYS = [
  "router",
  "analyst",
  "architect",
  "coder",
  "reviewer",
  "verifier",
  "ops",
] as const;

export type IAgentSlotKey = (typeof AGENT_SLOT_KEYS)[number];

/** local：仅需 Base URL + 模型名； hosted：通常需要 API Key + 模型 ID。每个槽位独立一套。 */
export type IAgentInferenceMode = "local" | "hosted";

export type IAgentInferencePublic = {
  mode: IAgentInferenceMode;
  baseUrl: string | null;
  hostedProvider: string | null;
  apiKeyConfigured: boolean;
};

export type IAgentSlotPublic = IAgentInferencePublic & {
  model: string;
};

export type IAuthUser = {
  id: string;
  email: string;
  /** 固定包含 AGENT_SLOT_KEYS 全部键；未配置则为默认空槽位。 */
  agentSlots: Record<IAgentSlotKey, IAgentSlotPublic>;
};

export type IAuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: IAuthUser;
};

export type IAuthRefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type IAuthMeResponse = {
  user: IAuthUser;
};

/** 更新若干槽位；某键为 `null` 表示删除该槽落库记录。 */
export type IAuthPatchAgentSlotBody = {
  mode: IAgentInferenceMode;
  model: string;
  baseUrl?: string | null;
  hostedProvider?: string | null;
  apiKey?: string | null;
};

export type IAuthPatchMeBody = {
  agentSlots: Partial<Record<IAgentSlotKey, IAuthPatchAgentSlotBody | null>>;
};

export type IAuthInferenceTestBody = {
  slotKey: IAgentSlotKey;
  /** 覆盖只用于探测的模型名；不传则用该槽已保存的 model */
  model?: string;
};

export type IAuthInferenceTestProbe = "ollama_tags" | "openai_models" | "skipped";

export type IAuthInferenceTestResponse = {
  ok: boolean;
  probe: IAuthInferenceTestProbe;
  message: string;
};
