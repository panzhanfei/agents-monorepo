import type { IAgentChatConversationRow, IAgentChatMessageRow } from "@agents/shared-types";
import type { IChatLine } from "./interface";

export const rowsToLines = (messages: IAgentChatMessageRow[]): IChatLine[] => {
  const out: IChatLine[] = [];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ id: m.id, role: m.role, text: m.content });
    }
  }
  return out;
};

export const conversationRowLabel = (c: IAgentChatConversationRow): string => {
  const t = c.title?.trim();
  if (t) return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  const d = new Date(c.updatedAt);
  return `会话 · ${d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

export const tokenRemainingPct = (remaining: number, total: number): number =>
  total <= 0 ? 0 : clampPct((remaining / total) * 100);

export const tokenBarColorVar = (remainingPct: number): string =>
  remainingPct <= 10 ? "var(--red-9)" : remainingPct <= 28 ? "var(--amber-9)" : "var(--jade-9)";
