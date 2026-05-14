import type {
  IAgentChatAppendResponse,
  IAgentChatClearResponse,
  IAgentChatConversationsResponse,
  IAgentChatCreateConversationBody,
  IAgentChatCreateConversationResponse,
  IAgentChatMessagesResponse,
  IAgentChatPatchConversationResponse,
  IAgentChatRole,
} from "@agents/shared-types";
import { Router } from "express";
import type { RequestHandler } from "express";
import type { AgentChatConversation, AgentChatMessage } from "@prisma/client";
import { z } from "zod";
import { prisma, HttpError, requireUserIdOrThrow, pickRouteStringParam } from "@/lib";

const roleSchema = z.enum(["user", "assistant", "system"]);

const appendSchema = z.object({
  role: roleSchema,
  content: z.string().min(1).max(128_000),
});

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

const patchConversationSchema = z
  .object({
    title: z.union([z.string().max(200), z.null()]).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((o) => o.title !== undefined || o.pinned !== undefined, {
    message: "At least one of title, pinned is required",
  });

const rowToDto = (m: AgentChatMessage) => ({
  id: m.id,
  projectId: m.projectId,
  conversationId: m.conversationId,
  role: m.role as IAgentChatRole,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

const convToDto = (c: AgentChatConversation) => ({
  id: c.id,
  projectId: c.projectId,
  title: c.title,
  pinned: c.pinned,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

export const projectChatRouter = Router({ mergeParams: true });

const requireProjectOrThrow = async (userId: string, projectId: string) => {
  const row = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!row) throw new HttpError(404, "not_found", "Project not found");
};

const requireConversationInProjectOrThrow = async (
  userId: string,
  projectId: string,
  conversationId: string,
): Promise<AgentChatConversation> => {
  const conv = await prisma.agentChatConversation.findFirst({
    where: {
      id: conversationId,
      projectId,
      project: { userId },
    },
  });
  if (!conv) throw new HttpError(404, "not_found", "Conversation not found");
  return conv;
};

const touchConversationUpdatedAt = async (conversationId: string): Promise<void> => {
  await prisma.agentChatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
};

const handleListConversations: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOrThrow(userId, projectId);

    const rows = await prisma.agentChatConversation.findMany({
      where: { projectId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });
    const body: IAgentChatConversationsResponse = { conversations: rows.map(convToDto) };
    res.json(body);
  } catch (e) {
    next(e);
  }
};

const handleCreateConversation: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOrThrow(userId, projectId);

    const body = createConversationSchema.parse(req.body ?? {});
    const titleTrimmed = body.title?.trim();

    const created = await prisma.agentChatConversation.create({
      data: {
        projectId,
        ...(titleTrimmed ? { title: titleTrimmed.slice(0, 200) } : {}),
      },
    });
    const payload: IAgentChatCreateConversationResponse = { conversation: convToDto(created) };
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

const handlePatchConversation: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);

    const body = patchConversationSchema.parse(req.body ?? {});
    const data: { title?: string | null; pinned?: boolean } = {};
    if (body.title !== undefined) {
      if (body.title === null) data.title = null;
      else {
        const t = body.title.trim();
        data.title = t.length === 0 ? null : t.slice(0, 200);
      }
    }
    if (body.pinned !== undefined) data.pinned = body.pinned;

    const updated = await prisma.agentChatConversation.update({
      where: { id: conversationId },
      data,
    });
    const payload: IAgentChatPatchConversationResponse = { conversation: convToDto(updated) };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const handleDeleteConversation: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);

    await prisma.agentChatConversation.delete({ where: { id: conversationId } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

const handleListMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);

    const rows = await prisma.agentChatMessage.findMany({
      where: { conversationId },
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
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);

    const body = appendSchema.parse(req.body);
    const created = await prisma.agentChatMessage.create({
      data: {
        projectId,
        conversationId,
        role: body.role,
        content: body.content,
      },
    });
    await touchConversationUpdatedAt(conversationId);
    const payload: IAgentChatAppendResponse = { message: rowToDto(created) };
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

const handleClearConversationMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);

    const removed = await prisma.agentChatMessage.deleteMany({ where: { conversationId } });
    await touchConversationUpdatedAt(conversationId);
    const payload: IAgentChatClearResponse = { deletedCount: removed.count };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

projectChatRouter.get("/conversations", handleListConversations);
projectChatRouter.post("/conversations", handleCreateConversation);
projectChatRouter.patch("/conversations/:conversationId", handlePatchConversation);
projectChatRouter.get("/conversations/:conversationId/messages", handleListMessages);
projectChatRouter.post("/conversations/:conversationId/messages", handleAppendMessage);
projectChatRouter.delete("/conversations/:conversationId/messages", handleClearConversationMessages);
projectChatRouter.delete("/conversations/:conversationId", handleDeleteConversation);
