import { fetchJson } from "./client";
import type { IEnqueueTaskBody, ITaskDetailResponse, ITasksListResponse } from "./interface";

export const fetchTasksForProject = (projectId: string): Promise<ITasksListResponse> =>
  fetchJson<ITasksListResponse>(`/tasks/project/${encodeURIComponent(projectId)}`);

export const fetchTaskById = (taskId: string): Promise<ITaskDetailResponse> =>
  fetchJson<ITaskDetailResponse>(`/tasks/${encodeURIComponent(taskId)}`);

export const enqueueTask = (body: IEnqueueTaskBody): Promise<unknown> =>
  fetchJson("/tasks/enqueue", {
    method: "POST",
    body: JSON.stringify(body),
  });
