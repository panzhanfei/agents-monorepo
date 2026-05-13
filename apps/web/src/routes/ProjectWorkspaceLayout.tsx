import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useCurrentProjectStore } from "@/stores";

export const ProjectWorkspaceLayout = () => {
  const projectId = useParams().projectId ?? "";
  const setCurrentProjectId = useCurrentProjectStore((s) => s.setCurrentProjectId);

  useEffect(() => {
    if (projectId) setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  return <Outlet />;
};
