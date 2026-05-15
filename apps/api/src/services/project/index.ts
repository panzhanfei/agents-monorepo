import { HttpError } from "@/lib";
import {
  deleteProjectById,
  findManyProjectsByUserId,
  findProjectOwned,
  insertProject,
  updateProjectById,
} from "@/models/project";
import type { Project } from "@prisma/client";

export const listProjectsForUser = (userId: string): Promise<Project[]> =>
  findManyProjectsByUserId(userId);

export const createProject = async (params: {
  userId: string;
  name: string;
  workspaceRoot: string;
  gitUrl?: string;
}): Promise<Project> => insertProject(params);

export const updateProjectForUser = async (params: {
  userId: string;
  projectId: string;
  name?: string;
  workspaceRoot?: string;
  gitUrl?: string | null;
}): Promise<Project> => {
  const hasUpdates =
    params.name !== undefined || params.workspaceRoot !== undefined || params.gitUrl !== undefined;
  if (!hasUpdates) throw new HttpError(400, "validation_error", "No fields to update");

  const existing = await findProjectOwned(params.userId, params.projectId);
  if (!existing) throw new HttpError(404, "not_found", "Project not found");

  return updateProjectById(params.projectId, {
    ...(params.name !== undefined ? { name: params.name } : {}),
    ...(params.workspaceRoot !== undefined ? { workspaceRoot: params.workspaceRoot } : {}),
    ...(params.gitUrl !== undefined ? { gitUrl: params.gitUrl } : {}),
  });
};

export const deleteProjectForUser = async (userId: string, projectId: string): Promise<void> => {
  const existing = await findProjectOwned(userId, projectId);
  if (!existing) throw new HttpError(404, "not_found", "Project not found");
  await deleteProjectById(projectId);
};
