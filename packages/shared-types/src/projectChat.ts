export type IAgentChatRole = "user" | "assistant" | "system";

export type IAgentChatMessageRow = {
  id: string;
  projectId: string;
  role: IAgentChatRole;
  content: string;
  /** ISO 8601 */
  createdAt: string;
};

export type IAgentChatMessagesResponse = {
  messages: IAgentChatMessageRow[];
};

export type IAgentChatAppendBody = {
  role: IAgentChatRole;
  content: string;
};

export type IAgentChatAppendResponse = {
  message: IAgentChatMessageRow;
};
