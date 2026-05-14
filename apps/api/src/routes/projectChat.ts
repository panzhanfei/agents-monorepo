import type { IAgentChatAppendResponse, IAgentChatMessagesResponse, IAgentChatRole } from "@agents/shared-types";
import { Router } from "express";
import type { RequestHandler } from "express";
import type { AgentChatMessage } from "@prisma/client";
import { z } from "zod";
import { prisma, HttpError, requireUserIdOrThrow, pickRouteStringParam } from "@/lib";

const roleSchema = z.enum(["user", "assistant", "system"]);

const appendSchema = z.object({
  role: roleSchema,
  content: z.string().min(1).max(128_000),
});

const rowToDto = (m: AgentChatMessage) => ({
  id: m.id,
  projectId: m.projectId,
  role: m.role as IAgentChatRole,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

export const projectChatRouter = Router({ mergeParams: true });

const requireProjectOrThrow = async (userId: string, projectId: string) => {
  const row = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!row) throw new HttpError(404, "not_found", "Project not found");
};

const handleListMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOrThrow(userId, projectId);

    const rows = await prisma.agentChatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    const body: IAgentChatMessagesResponse = { messages: rows.map(rowToDto) };
    res.json(body);
  } catch (e) {
    next(e);
  }
};

const handleAppendMessage: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOrThrow(userId, projectId);

    const body = appendSchema.parse(req.body);
    const created = await prisma.agentChatMessage.create({
      data: {
        projectId,
        role: body.role,
        content: body.content,
      },
    });
    const payload: IAgentChatAppendResponse = { message: rowToDto(created) };
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

projectChatRouter.get("/messages", handleListMessages);
projectChatRouter.post("/messages", handleAppendMessage);
