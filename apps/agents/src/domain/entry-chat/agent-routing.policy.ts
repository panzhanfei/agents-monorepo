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
