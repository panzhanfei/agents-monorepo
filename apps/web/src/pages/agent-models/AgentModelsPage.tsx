import { AgentModelsPageView } from "./AgentModelsPageView";
import { useAgentModelsPage } from "./useAgentModelsPage";

export const AgentModelsPage = () => {
  const vm = useAgentModelsPage();
  return <AgentModelsPageView vm={vm} />;
};
