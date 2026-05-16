import { ProjectDialoguePageView } from "./components/ProjectDialoguePageView";
import { useProjectDialoguePage } from "./useProjectDialoguePage";

export const ProjectDialoguePage = () => {
  const vm = useProjectDialoguePage();
  return <ProjectDialoguePageView vm={vm} />;
};
