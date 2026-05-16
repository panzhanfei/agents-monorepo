export const LOGICAL_ROLE_TO_CONFIG_SLOT: Record<string, string> = {
  analyst: "analyst",
  pm_spec: "analyst",
  architect: "architect",
  contract_split: "architect",
  coder_backend: "coder",
  coder_frontend: "coder",
  coder_fullstack: "coder",
  coder_bff: "coder",
  verify_unit: "verifier",
  verify_e2e: "verifier",
  ops: "ops",
};

export const ROUTABLE_AGENT_SLOTS = new Set(Object.keys(LOGICAL_ROLE_TO_CONFIG_SLOT));

const ROUTE_SLOT_ALIASES: Record<string, string> = {
  coder: "coder_fullstack",
  reviewer: "verify_unit",
};

export const resolveRouteSlotAlias = (key: string): string =>
  ROUTE_SLOT_ALIASES[key] ?? key;

export const configSlotForLogicalRole = (logicalRole: string): string | undefined =>
  LOGICAL_ROLE_TO_CONFIG_SLOT[logicalRole];

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
