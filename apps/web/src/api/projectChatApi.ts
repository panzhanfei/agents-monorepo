import { fetchJson } from "./client";
import type {
  IAgentChatAppendBody,
  IAgentChatAppendResponse,
  IAgentChatMessagesResponse,
} from "@agents/shared-types";

export const fetchProjectChatMessages = (
  projectId: string,
): Promise<IAgentChatMessagesResponse> =>
  fetchJson<IAgentChatMessagesResponse>(
    `/projects/${encodeURIComponent(projectId)}/chat/messages`,
  );

export const postProjectChatMessage = (
  projectId: string,
  body: IAgentChatAppendBody,
): Promise<IAgentChatAppendResponse> =>
  fetchJson<IAgentChatAppendResponse>(`/projects/${encodeURIComponent(projectId)}/chat/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
