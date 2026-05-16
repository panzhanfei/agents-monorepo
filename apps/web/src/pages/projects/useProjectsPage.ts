import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "@/api";
import type { IProjectRow } from "@/api";
import {
  getCreateProjectMutationErrorMessage,
  getProjectsMutationErrorMessage,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsListQuery,
} from "@/hooks";
import { useCurrentProjectStore } from "@/stores";
import { PROJECTS_PAGE_SIZE } from "./constants";

export const useProjectsPage = () => {
  const projectsQ = useProjectsListQuery();
  const createM = useCreateProjectMutation();
  const deleteM = useDeleteProjectMutation();
  const currentProjectId = useCurrentProjectStore((s) => s.currentProjectId);
  const setCurrentProjectId = useCurrentProjectStore((s) => s.setCurrentProjectId);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("Demo Project");
  const [workspaceRoot, setWorkspaceRoot] = useState("/tmp/demo-workspace");
  const [gitUrlDraft, setGitUrlDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<IProjectRow | null>(null);

  const filtered = useMemo(() => {
    const list = projectsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.workspaceRoot.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.gitUrl ?? "").toLowerCase().includes(q),
    );
  }, [projectsQ.data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PROJECTS_PAGE_SIZE;
    return filtered.slice(start, start + PROJECTS_PAGE_SIZE);
  }, [filtered, page]);

  const rememberedProject = useMemo(() => {
    if (!currentProjectId) return null;
    const list = projectsQ.data ?? [];
    return list.find((p) => p.id === currentProjectId) ?? null;
  }, [currentProjectId, projectsQ.data]);

  const loadError = projectsQ.isError
    ? projectsQ.error instanceof ApiError
      ? projectsQ.error.message
      : "Failed to load projects"
    : null;
  const createError = createM.isError ? getCreateProjectMutationErrorMessage(createM.error) : null;
  const deleteError = deleteM.isError ? getProjectsMutationErrorMessage(deleteM.error) : null;
  const error = loadError ?? createError ?? deleteError;

  const onCreate = (e: FormEvent): void => {
    e.preventDefault();
    const g = gitUrlDraft.trim();
    createM.mutate(
      { name, workspaceRoot, ...(g.length > 0 ? { gitUrl: g } : {}) },
      {
        onSuccess: (res) => {
          setCurrentProjectId(res.project.id);
          setCreateOpen(false);
        },
      },
    );
  };

  const onConfirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteM.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  return {
    projectsQ,
    createM,
    deleteM,
    currentProjectId,
    search,
    setSearch,
    page,
    setPage,
    createOpen,
    setCreateOpen,
    name,
    setName,
    workspaceRoot,
    setWorkspaceRoot,
    gitUrlDraft,
    setGitUrlDraft,
    pendingDelete,
    setPendingDelete,
    filtered,
    totalPages,
    pageRows,
    rememberedProject,
    error,
    onCreate,
    onConfirmDelete,
    pageSize: PROJECTS_PAGE_SIZE,
  };
};

export type IProjectsPageViewModel = ReturnType<typeof useProjectsPage>;
