import { fetchJson } from "./client";
import type {
  IAgentChatAppendBody,
  IAgentChatAppendResponse,
  IAgentChatClearResponse,
  IAgentChatConversationsResponse,
  IAgentChatCreateConversationBody,
  IAgentChatCreateConversationResponse,
  IAgentChatMessagesResponse,
  IAgentChatPatchConversationBody,
  IAgentChatPatchConversationResponse,
} from "@agents/shared-types";

const chatRoot = (projectId: string): string =>
  `/projects/${encodeURIComponent(projectId)}/chat`;

export const fetchProjectChatConversations = (
  projectId: string,
): Promise<IAgentChatConversationsResponse> =>
  fetchJson<IAgentChatConversationsResponse>(`${chatRoot(projectId)}/conversations`);

export const postProjectChatConversation = (
  projectId: string,
  body?: IAgentChatCreateConversationBody,
): Promise<IAgentChatCreateConversationResponse> =>
  fetchJson<IAgentChatCreateConversationResponse>(`${chatRoot(projectId)}/conversations`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

export const deleteProjectChatConversation = (
  projectId: string,
  conversationId: string,
): Promise<void> =>
  fetchJson<void>(`${chatRoot(projectId)}/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });

export const patchProjectChatConversation = (
  projectId: string,
  conversationId: string,
  body: IAgentChatPatchConversationBody,
): Promise<IAgentChatPatchConversationResponse> =>
  fetchJson<IAgentChatPatchConversationResponse>(
    `${chatRoot(projectId)}/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );

export const fetchProjectChatMessages = (
  projectId: string,
  conversationId: string,
): Promise<IAgentChatMessagesResponse> =>
  fetchJson<IAgentChatMessagesResponse>(
    `${chatRoot(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
  );

export const postProjectChatMessage = (
  projectId: string,
  conversationId: string,
  body: IAgentChatAppendBody,
): Promise<IAgentChatAppendResponse> =>
  fetchJson<IAgentChatAppendResponse>(
    `${chatRoot(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

export const deleteProjectConversationMessages = (
  projectId: string,
  conversationId: string,
): Promise<IAgentChatClearResponse> =>
  fetchJson<IAgentChatClearResponse>(
    `${chatRoot(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "DELETE",
    },
  );
