import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, enqueueTask, fetchTaskById, fetchTasksForProject, type IEnqueueTaskBody } from "@/api";
import { queryKeys } from "@/query/keys";

export const useTasksByProjectQuery = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.tasks.byProject(projectId),
    queryFn: () => fetchTasksForProject(projectId),
    select: (d) => d.tasks,
    enabled: Boolean(projectId),
  });

export const useEnqueueTaskMutation = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IEnqueueTaskBody) => enqueueTask(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId) });
    },
  });
};

export const useTaskDetailQuery = (taskId: string | null, pollMs: number) =>
  useQuery({
    queryKey: queryKeys.tasks.detail(taskId ?? "__none__"),
    queryFn: () => fetchTaskById(taskId!),
    select: (d) => d.task,
    enabled: Boolean(taskId),
    refetchInterval: taskId ? pollMs : false,
  });

export const getTasksMutationErrorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "Enqueue failed";
