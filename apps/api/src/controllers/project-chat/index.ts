import type { RequestHandler } from "express";
import { z } from "zod";
import { requireUserIdOrThrow, pickRouteStringParam } from "@/lib";
import {
  appendMessage,
  clearMessagesForConversation,
  createConversation,
  deleteConversation,
  listConversationsForProject,
  listMessagesForConversation,
  patchConversation,
  requireConversationInProjectOrThrow,
  requireProjectOwnedOrThrow,
} from "@/services/project-chat";
import {
  toAppendMessageResponse,
  toClearMessagesResponse,
  toConversationsResponse,
  toCreateConversationResponse,
  toMessagesResponse,
  toPatchConversationResponse,
} from "@/views/project-chat";

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

const getConversations: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOwnedOrThrow(userId, projectId);
    const rows = await listConversationsForProject(projectId);
    res.json(toConversationsResponse(rows));
  } catch (e) {
    next(e);
  }
};

const postConversation: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    await requireProjectOwnedOrThrow(userId, projectId);
    const body = createConversationSchema.parse(req.body ?? {});
    const titleTrimmed = body.title?.trim();
    const created = await createConversation(projectId, titleTrimmed);
    res.status(201).json(toCreateConversationResponse(created));
  } catch (e) {
    next(e);
  }
};

const patchConversationHandler: RequestHandler = async (req, res, next) => {
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
    const updated = await patchConversation(conversationId, data);
    res.json(toPatchConversationResponse(updated));
  } catch (e) {
    next(e);
  }
};

const deleteConversationHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);
    await deleteConversation(conversationId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

const getMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);
    const rows = await listMessagesForConversation(conversationId);
    res.json(toMessagesResponse(rows));
  } catch (e) {
    next(e);
  }
};

const postMessage: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);
    const body = appendSchema.parse(req.body);
    const created = await appendMessage({
      projectId,
      conversationId,
      role: body.role,
      content: body.content,
    });
    res.status(201).json(toAppendMessageResponse(created));
  } catch (e) {
    next(e);
  }
};

const deleteMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const conversationId = pickRouteStringParam(req.params.conversationId, "conversationId");
    await requireConversationInProjectOrThrow(userId, projectId, conversationId);
    const deletedCount = await clearMessagesForConversation(conversationId);
    res.json(toClearMessagesResponse(deletedCount));
  } catch (e) {
    next(e);
  }
};

export const projectChatController = {
  getConversations,
  postConversation,
  patchConversation: patchConversationHandler,
  deleteConversation: deleteConversationHandler,
  getMessages,
  postMessage,
  deleteMessages,
};
