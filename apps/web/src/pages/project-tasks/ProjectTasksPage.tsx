import { ProjectTasksPageView } from "./ProjectTasksPageView";
import { useProjectTasksPage } from "./useProjectTasksPage";

export const ProjectTasksPage = () => {
  const vm = useProjectTasksPage();
  return <ProjectTasksPageView vm={vm} />;
};
