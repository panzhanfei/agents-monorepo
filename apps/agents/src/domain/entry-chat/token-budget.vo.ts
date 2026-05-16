import type { IChatLine } from "@/domain/entry-chat/chat-message.vo";

export const estimatePromptTokens = (messages: IChatLine[]): number => {
  const chars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  return Math.max(1, Math.floor(chars / 4));
};
