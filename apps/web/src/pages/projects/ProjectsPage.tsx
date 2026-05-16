import { ProjectsPageView } from "./ProjectsPageView";
import { useProjectsPage } from "./useProjectsPage";

export const ProjectsPage = () => {
  const vm = useProjectsPage();
  return <ProjectsPageView vm={vm} />;
};
