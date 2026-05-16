import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "@/api";
import { getProjectsMutationErrorMessage, useProjectsListQuery, useUpdateProjectMutation } from "@/hooks";

export const useProjectConfigPage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";

  const projectsQ = useProjectsListQuery();
  const updateM = useUpdateProjectMutation();

  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId) ?? null,
    [projectsQ.data, projectId],
  );

  const [name, setName] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [gitUrl, setGitUrl] = useState("");

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setWorkspaceRoot(project.workspaceRoot);
    setGitUrl(project.gitUrl ?? "");
  }, [project]);

  const loadError = projectsQ.isError
    ? projectsQ.error instanceof ApiError
      ? projectsQ.error.message
      : "Failed to load projects"
    : null;
  const saveError = updateM.isError ? getProjectsMutationErrorMessage(updateM.error) : null;
  const error = loadError ?? saveError;

  const onSave = (e: FormEvent): void => {
    e.preventDefault();
    if (!projectId) return;
    const body: { name?: string; workspaceRoot?: string; gitUrl?: string | null } = {};
    if (name.trim() && name.trim() !== project?.name) body.name = name.trim();
    if (workspaceRoot.trim() && workspaceRoot.trim() !== project?.workspaceRoot) {
      body.workspaceRoot = workspaceRoot.trim();
    }
    const gNext = gitUrl.trim();
    const gPrev = (project?.gitUrl ?? "").trim();
    if (gNext !== gPrev) body.gitUrl = gNext.length > 0 ? gNext : null;
    if (Object.keys(body).length === 0) return;
    updateM.mutate({ projectId, body });
  };

  const notFound = !projectsQ.isPending && !project && !loadError && Boolean(projectId);

  return {
    projectId,
    project,
    projectsQ,
    updateM,
    name,
    setName,
    workspaceRoot,
    setWorkspaceRoot,
    gitUrl,
    setGitUrl,
    error,
    onSave,
    notFound,
  };
};

export type IProjectConfigPageViewModel = ReturnType<typeof useProjectConfigPage>;
