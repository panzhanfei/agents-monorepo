import { prisma } from "@/lib";
import type { Project } from "@prisma/client";

export const findManyProjectsByUserId = (userId: string): Promise<Project[]> =>
  prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

export const findProjectOwned = (userId: string, projectId: string): Promise<Project | null> =>
  prisma.project.findFirst({
    where: { id: projectId, userId },
  });

export const insertProject = (params: {
  userId: string;
  name: string;
  workspaceRoot: string;
  gitUrl?: string;
}): Promise<Project> =>
  prisma.project.create({
    data: {
      userId: params.userId,
      name: params.name,
      workspaceRoot: params.workspaceRoot,
      ...(params.gitUrl !== undefined ? { gitUrl: params.gitUrl } : {}),
    },
  });

export const updateProjectById = (
  projectId: string,
  data: { name?: string; workspaceRoot?: string; gitUrl?: string | null },
): Promise<Project> =>
  prisma.project.update({
    where: { id: projectId },
    data,
  });

export const deleteProjectById = (projectId: string): Promise<void> =>
  prisma.project.delete({ where: { id: projectId } }).then(() => undefined);
