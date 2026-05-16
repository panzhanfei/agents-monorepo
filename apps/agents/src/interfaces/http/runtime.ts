import type { IAgentsConfig, IStatefulAgentSlotsGateway } from "@/infrastructure";
import type { IEntryChatLlmGateway, ISetupTokenStore } from "@/domain";

export type IAppRuntime = {
  config: IAgentsConfig;
  agentSlots: IStatefulAgentSlotsGateway;
  llm: IEntryChatLlmGateway;
  setupToken: ISetupTokenStore;
  localDotenvPath: string;
};
