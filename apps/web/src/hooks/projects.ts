import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  createProject,
  deleteProject,
  fetchProjects,
  patchProject,
  type ICreateProjectBody,
  type IUpdateProjectBody,
} from "@/api";
import { useAuth } from "@/auth";
import { queryKeys } from "@/query/keys";
import { useCurrentProjectStore } from "@/stores";

export const useProjectsListQuery = () => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
    select: (d) => d.projects,
    enabled: Boolean(accessToken),
  });
};

export const useCreateProjectMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateProjectBody) => createProject(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
};

export const useUpdateProjectMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { projectId: string; body: IUpdateProjectBody }) =>
      patchProject(args.projectId, args.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
};

export const useDeleteProjectMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: (_data, projectId) => {
      useCurrentProjectStore.getState().clearCurrentProjectIfMatches(projectId);
      void qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId) });
    },
  });
};

export const getProjectsMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "操作失败";

export const getCreateProjectMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "Create failed";
