import { HttpError } from "@/lib";
import {
  appendMessageRow,
  clearMessagesForConversationRow,
  createConversationRow,
  deleteConversationRow,
  findConversationScoped,
  selectOwnedProject,
  listConversationsForProject as listConversationRows,
  listMessagesForConversation as listMessageRows,
  patchConversationRow,
} from "@/models/project-chat";
import type { AgentChatConversation } from "@prisma/client";

export const requireProjectOwnedOrThrow = async (userId: string, projectId: string): Promise<void> => {
  const row = await selectOwnedProject(userId, projectId);
  if (!row) throw new HttpError(404, "not_found", "Project not found");
};

export const requireConversationInProjectOrThrow = async (
  userId: string,
  projectId: string,
  conversationId: string,
): Promise<AgentChatConversation> => {
  const conv = await findConversationScoped(userId, projectId, conversationId);
  if (!conv) throw new HttpError(404, "not_found", "Conversation not found");
  return conv;
};

export const listConversationsForProject = (projectId: string) =>
  listConversationRows(projectId);

export const createConversation = (projectId: string, titleTrimmed: string | undefined) =>
  createConversationRow(projectId, titleTrimmed);

export const patchConversation = (
  conversationId: string,
  data: { title?: string | null; pinned?: boolean },
) => patchConversationRow(conversationId, data);

export const deleteConversation = (conversationId: string) =>
  deleteConversationRow(conversationId);

export const listMessagesForConversation = (conversationId: string) =>
  listMessageRows(conversationId);

export const appendMessage = (params: {
  projectId: string;
  conversationId: string;
  role: string;
  content: string;
}) => appendMessageRow(params);

export const clearMessagesForConversation = (conversationId: string) =>
  clearMessagesForConversationRow(conversationId);
