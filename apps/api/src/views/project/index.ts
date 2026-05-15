import type { Project } from "@prisma/client";

export const projectsListPayload = (projects: Project[]) => ({ projects });

export const projectMutatePayload = (project: Project) => ({ project });
