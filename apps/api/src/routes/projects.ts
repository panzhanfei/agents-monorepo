import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma, HttpError, requireUserIdOrThrow, pickRouteStringParam } from "@/lib";
import { requireUser } from "@/middleware";

export const projectsRouter = Router();

projectsRouter.use(requireUser);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  workspaceRoot: z.string().min(1).max(4096),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  workspaceRoot: z.string().min(1).max(4096).optional(),
});

const handleList: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ projects });
  } catch (e) {
    next(e);
  }
};

const handleCreate: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = createSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        userId,
        name: body.name,
        workspaceRoot: body.workspaceRoot,
      },
    });
    res.status(201).json({ project });
  } catch (e) {
    next(e);
  }
};

const handlePatch: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const body = updateSchema.parse(req.body);
    if (!body.name && !body.workspaceRoot) {
      throw new HttpError(400, "validation_error", "No fields to update");
    }

    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!existing) throw new HttpError(404, "not_found", "Project not found");

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.workspaceRoot !== undefined ? { workspaceRoot: body.workspaceRoot } : {}),
      },
    });
    res.json({ project });
  } catch (e) {
    next(e);
  }
};

const handleDelete: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!existing) throw new HttpError(404, "not_found", "Project not found");

    await prisma.project.delete({ where: { id: projectId } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

projectsRouter.get("/", handleList);
projectsRouter.post("/", handleCreate);
projectsRouter.patch("/:projectId", handlePatch);
projectsRouter.delete("/:projectId", handleDelete);
