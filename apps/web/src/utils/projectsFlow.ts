import type { Dispatch, SetStateAction } from "react";
import {
  ApiError,
  createProject,
  fetchProjects,
  type ICreateProjectBody,
  type IProjectRow,
} from "@/api";

export const runProjectsReload = (
  setProjects: Dispatch<SetStateAction<IProjectRow[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
): void => {
  setLoading(true);
  setError(null);
  void fetchProjects()
    .then((body) => setProjects(body.projects))
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : "Failed to load projects";
      setError(msg);
    })
    .finally(() => setLoading(false));
};

export const runCreateProject = (
  body: ICreateProjectBody,
  afterOk: () => void,
  setError: Dispatch<SetStateAction<string | null>>,
): void => {
  setError(null);
  void createProject(body)
    .then(() => afterOk())
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : "Create failed";
      setError(msg);
    });
};
