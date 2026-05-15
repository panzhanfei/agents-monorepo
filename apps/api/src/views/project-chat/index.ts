import type {
  IAgentChatAppendResponse,
  IAgentChatClearResponse,
  IAgentChatConversationsResponse,
  IAgentChatCreateConversationResponse,
  IAgentChatMessagesResponse,
  IAgentChatPatchConversationResponse,
  IAgentChatRole,
} from "@agents/shared-types";
import type { AgentChatConversation, AgentChatMessage } from "@prisma/client";

export const chatMessageToDto = (m: AgentChatMessage) => ({
  id: m.id,
  projectId: m.projectId,
  conversationId: m.conversationId,
  role: m.role as IAgentChatRole,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

export const chatConversationToDto = (c: AgentChatConversation) => ({
  id: c.id,
  projectId: c.projectId,
  title: c.title,
  pinned: c.pinned,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

export const toConversationsResponse = (
  rows: AgentChatConversation[],
): IAgentChatConversationsResponse => ({
  conversations: rows.map(chatConversationToDto),
});

export const toCreateConversationResponse = (
  created: AgentChatConversation,
): IAgentChatCreateConversationResponse => ({
  conversation: chatConversationToDto(created),
});

export const toPatchConversationResponse = (
  updated: AgentChatConversation,
): IAgentChatPatchConversationResponse => ({
  conversation: chatConversationToDto(updated),
});

export const toMessagesResponse = (rows: AgentChatMessage[]): IAgentChatMessagesResponse => ({
  messages: rows.map(chatMessageToDto),
});

export const toAppendMessageResponse = (created: AgentChatMessage): IAgentChatAppendResponse => ({
  message: chatMessageToDto(created),
});

export const toClearMessagesResponse = (deletedCount: number): IAgentChatClearResponse => ({
  deletedCount,
});
