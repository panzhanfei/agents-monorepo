import { fetchJson } from "./client";
import type { ICreateProjectBody, IProjectsListResponse, IProjectMutationResponse } from "./interface";

export const fetchProjects = (): Promise<IProjectsListResponse> => fetchJson<IProjectsListResponse>("/projects");

export const createProject = (body: ICreateProjectBody): Promise<IProjectMutationResponse> =>
  fetchJson<IProjectMutationResponse>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
