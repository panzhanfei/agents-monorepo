import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  createProject,
  fetchProjects,
  patchProject,
  type ICreateProjectBody,
  type IUpdateProjectBody,
} from "@/api";
import { useAuth } from "@/auth";
import { queryKeys } from "@/query/keys";

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

export const getProjectsMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "Save failed";

export const getCreateProjectMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "Create failed";
