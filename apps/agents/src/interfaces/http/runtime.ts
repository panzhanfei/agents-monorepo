import type { IAgentsConfig } from "@/infrastructure/config/agents-settings";
import type { IStatefulAgentSlotsGateway } from "@/infrastructure/http/node-agent-slots.gateway";
import type { IEntryChatLlmGateway } from "@/domain/entry-chat/ports/llm.gateway";
import type { ISetupTokenStore } from "@/domain/setup/ports/setup-token.store";

export type IAppRuntime = {
  config: IAgentsConfig;
  agentSlots: IStatefulAgentSlotsGateway;
  llm: IEntryChatLlmGateway;
  setupToken: ISetupTokenStore;
  localDotenvPath: string;
};
