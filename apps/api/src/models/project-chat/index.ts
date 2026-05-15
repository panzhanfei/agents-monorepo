import type { AgentChatConversation } from "@prisma/client";
import { prisma } from "@/lib";

export const selectOwnedProject = (userId: string, projectId: string) =>
  prisma.project.findFirst({ where: { id: projectId, userId } });

export const findConversationScoped = (
  userId: string,
  projectId: string,
  conversationId: string,
): Promise<AgentChatConversation | null> =>
  prisma.agentChatConversation.findFirst({
    where: {
      id: conversationId,
      projectId,
      project: { userId },
    },
  });

const touchConversationUpdatedAt = async (conversationId: string): Promise<void> => {
  await prisma.agentChatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
};

export const listConversationsForProject = (projectId: string) =>
  prisma.agentChatConversation.findMany({
    where: { projectId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

export const createConversationRow = (projectId: string, titleTrimmed: string | undefined) =>
  prisma.agentChatConversation.create({
    data: {
      projectId,
      ...(titleTrimmed ? { title: titleTrimmed.slice(0, 200) } : {}),
    },
  });

export const patchConversationRow = (
  conversationId: string,
  data: { title?: string | null; pinned?: boolean },
) =>
  prisma.agentChatConversation.update({
    where: { id: conversationId },
    data,
  });

export const deleteConversationRow = (conversationId: string) =>
  prisma.agentChatConversation.delete({ where: { id: conversationId } });

export const listMessagesForConversation = (conversationId: string) =>
  prisma.agentChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

export const appendMessageRow = async (params: {
  projectId: string;
  conversationId: string;
  role: string;
  content: string;
}) => {
  const created = await prisma.agentChatMessage.create({
    data: {
      projectId: params.projectId,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
    },
  });
  await touchConversationUpdatedAt(params.conversationId);
  return created;
};

export const clearMessagesForConversationRow = async (conversationId: string) => {
  const removed = await prisma.agentChatMessage.deleteMany({ where: { conversationId } });
  await touchConversationUpdatedAt(conversationId);
  return removed.count;
};
