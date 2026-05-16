import {
  ROUTABLE_AGENT_SLOTS,
  resolveRouteSlotAlias,
} from "@/domain/entry-chat/agent-routing.policy";

export type IRouteDecision = { nextSlot: string; reason: string };

export const parseRoutePayload = (text: string): IRouteDecision => {
  let t = text.trim();
  if (!t) return { nextSlot: "analyst", reason: "" };
  const fence = /\{[^{}]*\}/s.exec(t);
  if (fence) t = fence[0];
  else {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
  }
  let data: { nextSlot?: unknown; next_slot?: unknown; reason?: unknown };
  try {
    data = JSON.parse(t) as { nextSlot?: unknown; next_slot?: unknown; reason?: unknown };
  } catch {
    return { nextSlot: "analyst", reason: "" };
  }
  const ns = data.nextSlot ?? data.next_slot;
  const reason = data.reason;
  const r = typeof reason === "string" ? reason.trim() : "";
  if (typeof ns !== "string") return { nextSlot: "analyst", reason: r };
  let key = ns
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  key = resolveRouteSlotAlias(key);
  if (!ROUTABLE_AGENT_SLOTS.has(key)) return { nextSlot: "analyst", reason: r };
  return { nextSlot: key, reason: r };
};
