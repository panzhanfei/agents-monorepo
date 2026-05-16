import { ProjectConfigPageView } from "./ProjectConfigPageView";
import { useProjectConfigPage } from "./useProjectConfigPage";

export const ProjectConfigPage = () => {
  const vm = useProjectConfigPage();
  return <ProjectConfigPageView vm={vm} />;
};
