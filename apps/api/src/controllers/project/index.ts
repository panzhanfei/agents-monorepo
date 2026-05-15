import type { RequestHandler } from "express";
import { z } from "zod";
import { requireUserIdOrThrow, pickRouteStringParam } from "@/lib";
import {
  createProject,
  deleteProjectForUser,
  listProjectsForUser,
  updateProjectForUser,
} from "@/services/project";
import { projectMutatePayload, projectsListPayload } from "@/views/project";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  workspaceRoot: z.string().min(1).max(4096),
  gitUrl: z.union([z.string().max(2048), z.null()]).optional(),
});

const normalizeOptionalGitUrl = (v: string | null | undefined): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
};

const normalizePatchGitUrl = (v: string | null | undefined): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
};

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  workspaceRoot: z.string().min(1).max(4096).optional(),
  gitUrl: z.union([z.string().max(2048), z.null()]).optional(),
});

const getList: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projects = await listProjectsForUser(userId);
    res.json(projectsListPayload(projects));
  } catch (e) {
    next(e);
  }
};

const postCreate: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = createSchema.parse(req.body);
    const gitUrlValue = normalizeOptionalGitUrl(body.gitUrl ?? undefined);
    const project = await createProject({
      userId,
      name: body.name,
      workspaceRoot: body.workspaceRoot,
      ...(gitUrlValue !== undefined ? { gitUrl: gitUrlValue } : {}),
    });
    res.status(201).json(projectMutatePayload(project));
  } catch (e) {
    next(e);
  }
};

const patchProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const body = updateSchema.parse(req.body);
    const normalizedGitUrl = normalizePatchGitUrl(body.gitUrl ?? undefined);
    const project = await updateProjectForUser({
      userId,
      projectId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.workspaceRoot !== undefined ? { workspaceRoot: body.workspaceRoot } : {}),
      ...(normalizedGitUrl !== undefined ? { gitUrl: normalizedGitUrl } : {}),
    });
    res.json(projectMutatePayload(project));
  } catch (e) {
    next(e);
  }
};

const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await deleteProjectForUser(userId, projectId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

export const projectsController = {
  getList,
  postCreate,
  patchProject,
  deleteProject,
};
