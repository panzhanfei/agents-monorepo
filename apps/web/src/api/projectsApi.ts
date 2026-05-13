import { fetchJson } from "./client";
import type {
  ICreateProjectBody,
  IProjectsListResponse,
  IProjectMutationResponse,
  IUpdateProjectBody,
} from "./interface";

export const fetchProjects = (): Promise<IProjectsListResponse> => fetchJson<IProjectsListResponse>("/projects");

export const createProject = (body: ICreateProjectBody): Promise<IProjectMutationResponse> =>
  fetchJson<IProjectMutationResponse>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchProject = (projectId: string, body: IUpdateProjectBody): Promise<IProjectMutationResponse> =>
  fetchJson<IProjectMutationResponse>(`/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteProject = (projectId: string): Promise<void> =>
  fetchJson<void>(`/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
