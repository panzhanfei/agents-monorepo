import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, createProject, fetchProjects, type ICreateProjectBody } from "@/api";
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

export const getProjectsMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "Create failed";
