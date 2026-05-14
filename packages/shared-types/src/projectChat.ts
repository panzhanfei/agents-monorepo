export type IAgentChatRole = "user" | "assistant" | "system";

export type IAgentChatConversationRow = {
  id: string;
  projectId: string;
  title: string | null;
  /** 置顶会话排在列表前 */
  pinned: boolean;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
};

export type IAgentChatConversationsResponse = {
  conversations: IAgentChatConversationRow[];
};

export type IAgentChatCreateConversationBody = {
  title?: string | null;
};

export type IAgentChatCreateConversationResponse = {
  conversation: IAgentChatConversationRow;
};

export type IAgentChatPatchConversationBody = {
  title?: string | null;
  pinned?: boolean;
};

export type IAgentChatPatchConversationResponse = {
  conversation: IAgentChatConversationRow;
};

export type IAgentChatMessageRow = {
  id: string;
  projectId: string;
  conversationId: string;
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

export type IAgentChatClearResponse = {
  deletedCount: number;
};
