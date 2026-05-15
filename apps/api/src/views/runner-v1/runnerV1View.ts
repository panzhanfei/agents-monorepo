import type { IAgentSlotKey, IRunnerAgentSlotSecret, IRunnerAgentSlotsResponse } from "@agents/shared-types";
import type { UserAgentSlotConfig } from "@prisma/client";

export const stripEtagQuotes = (raw: string): string => {
  let s = raw.trim();
  if (s.startsWith("W/")) {
    s = s.slice(2).trim();
  }
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s;
};

const buildAgentSlotsRevision = (
  keys: IAgentSlotKey[],
  byKey: Map<string, Pick<UserAgentSlotConfig, "updatedAt">>,
): string =>
  [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const row = byKey.get(k);
      return `${k}:${row ? row.updatedAt.toISOString() : "_"}`;
    })
    .join(";");

const toRunnerSlotSecret = (row: UserAgentSlotConfig): IRunnerAgentSlotSecret => {
  const mode = row.inferenceMode === "local" ? "local" : "hosted";
  return {
    mode,
    model: row.modelId,
    baseUrl: row.baseUrl ?? null,
    hostedProvider: row.hostedProvider ?? null,
    apiKey: row.apiKey ?? null,
  };
};

export const buildRunnerAgentSlotsResponse = (
  keys: IAgentSlotKey[],
  rows: UserAgentSlotConfig[],
): IRunnerAgentSlotsResponse => {
  const byKey = new Map(rows.map((r) => [r.slotKey, r]));
  const configRevision = buildAgentSlotsRevision(keys, byKey);
  const slots: IRunnerAgentSlotsResponse["slots"] = {};
  for (const k of keys) {
    const row = byKey.get(k);
    slots[k] = row ? toRunnerSlotSecret(row) : null;
  }
  return { configRevision, slots };
};
