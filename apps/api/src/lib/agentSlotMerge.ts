import type { IAuthPatchAgentSlotBody } from "@agents/shared-types";
import { AgentInferenceMode, type UserAgentSlotConfig } from "@prisma/client";
import { mergeAgentInferenceStored } from "./agentInference";

export const userAgentSlotRowToInferenceRaw = (
  row: Pick<UserAgentSlotConfig, "inferenceMode" | "baseUrl" | "hostedProvider" | "apiKey">,
): Record<string, unknown> => ({
  mode: row.inferenceMode,
  baseUrl: row.baseUrl,
  hostedProvider: row.hostedProvider,
  ...(row.apiKey ? { apiKey: row.apiKey } : {}),
});

export const mergeAgentSlotForPersist = (
  existing: UserAgentSlotConfig | null,
  patch: IAuthPatchAgentSlotBody,
): {
  inferenceMode: AgentInferenceMode;
  baseUrl: string | null;
  hostedProvider: string | null;
  apiKey: string | null;
  modelId: string;
} => {
  const raw = existing ? userAgentSlotRowToInferenceRaw(existing) : {};
  const inf = mergeAgentInferenceStored(raw, {
    mode: patch.mode,
    baseUrl: patch.baseUrl,
    hostedProvider: patch.hostedProvider,
    apiKey: patch.apiKey,
  });
  return {
    inferenceMode: inf.mode === "hosted" ? AgentInferenceMode.hosted : AgentInferenceMode.local,
    baseUrl: inf.baseUrl,
    hostedProvider: inf.hostedProvider,
    apiKey: inf.apiKey,
    modelId: patch.model.trim(),
  };
};
