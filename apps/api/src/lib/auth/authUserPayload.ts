import { AGENT_SLOT_KEYS, type IAuthUser, type IAgentSlotKey, type IAgentSlotPublic } from "@agents/shared-types";
import type { Prisma } from "@prisma/client";
import { toAgentInferencePublic } from "../agent/agentInference";
import { userAgentSlotRowToInferenceRaw } from "../agent/agentSlotMerge";

export const userAgentSlotAuthSelect = {
  slotKey: true,
  inferenceMode: true,
  baseUrl: true,
  hostedProvider: true,
  apiKey: true,
  modelId: true,
} satisfies Prisma.UserAgentSlotConfigSelect;

export type IUserAgentSlotAuthRow = Prisma.UserAgentSlotConfigGetPayload<{ select: typeof userAgentSlotAuthSelect }>;

const emptySlotPublic = (): IAgentSlotPublic => ({
  mode: "local",
  baseUrl: null,
  hostedProvider: null,
  apiKeyConfigured: false,
  model: "",
});

const rowToSlotPublic = (row: IUserAgentSlotAuthRow): IAgentSlotPublic => {
  const inf = toAgentInferencePublic(userAgentSlotRowToInferenceRaw(row));
  return {
    mode: inf.mode,
    baseUrl: inf.baseUrl,
    hostedProvider: inf.hostedProvider,
    apiKeyConfigured: inf.apiKeyConfigured,
    model: row.modelId,
  };
};

const slotKeySet = new Set<string>(AGENT_SLOT_KEYS);

export const toAuthUserPayload = (row: { id: string; email: string }, slotRows: IUserAgentSlotAuthRow[]): IAuthUser => {
  const agentSlots = {} as Record<IAgentSlotKey, IAgentSlotPublic>;
  for (const key of AGENT_SLOT_KEYS) {
    agentSlots[key] = emptySlotPublic();
  }
  for (const r of slotRows) {
    if (slotKeySet.has(r.slotKey)) {
      agentSlots[r.slotKey as IAgentSlotKey] = rowToSlotPublic(r);
    }
  }
  return {
    id: row.id,
    email: row.email,
    agentSlots,
  };
};
