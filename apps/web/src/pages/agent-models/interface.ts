import type { IAgentInferenceMode } from "@agents/shared-types";

export type ISlotLocalDraft = {
  baseUrl: string;
  model: string;
};

export type ISlotHostedDraft = {
  baseUrl: string;
  model: string;
  hostedProvider: string;
  apiKeyDraft: string;
  clearApiKey: boolean;
};

export type ISlotDraft = {
  mode: IAgentInferenceMode;
  local: ISlotLocalDraft;
  hosted: ISlotHostedDraft;
};
