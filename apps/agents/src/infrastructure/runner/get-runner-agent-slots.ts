import {
  AGENT_SLOT_KEYS,
  type IAgentSlotKey,
  type IRunnerAgentSlotsResponse,
} from "@agents/shared-types";
import { z } from "zod";

import type { IResolvedRunnerCredentials } from "./resolve-runner-credentials";

import { buildRunnerAuthHeaders } from "./build-runner-auth-headers";
import { RunnerGatewayError } from "./runner-gateway.error";

export type IGetRunnerAgentSlotsOptions = Readonly<{
  /** Omit or empty → api returns all configured keys (matches `apps/api`). */
  keys?: readonly IAgentSlotKey[];
  /** `If-None-Match`; server compares against `configRevision` (quotes optional). */
  ifNoneMatch?: string;
}>;

export type IRunnerAgentSlotsResult =
  | { readonly status: 304; readonly etag: string | null }
  | {
      readonly status: 200;
      readonly etag: string | null;
      readonly payload: IRunnerAgentSlotsResponse;
    };

const keyIsSlot = (k: string): k is IAgentSlotKey =>
  (AGENT_SLOT_KEYS as readonly string[]).includes(k);

const runnerSlotSecretSchema = z.object({
  mode: z.enum(["local", "hosted"]),
  model: z.string(),
  baseUrl: z.string().nullable(),
  hostedProvider: z.string().nullable(),
  apiKey: z.string().nullable(),
});

const runnerAgentSlotsResponseSchema = z
  .object({
    configRevision: z.string(),
    slots: z.record(runnerSlotSecretSchema.nullable()),
  })
  .superRefine((val, ctx) => {
    for (const slotKey of Object.keys(val.slots)) {
      if (!keyIsSlot(slotKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown agent slot key: ${slotKey}`,
          path: ["slots", slotKey],
        });
      }
    }
  });

/** `GET /v1/runner/agent-slots` — Runner device headers (`requireRunner` bundle). */
export const getRunnerAgentSlots = async (
  creds: IResolvedRunnerCredentials,
  opts?: IGetRunnerAgentSlotsOptions,
): Promise<IRunnerAgentSlotsResult> => {
  const url = new URL(`${creds.apiBaseUrl}/v1/runner/agent-slots`);
  const keysParam = opts?.keys?.filter(Boolean).join(",");
  if (keysParam?.length) {
    url.searchParams.set("keys", keysParam);
  }

  const extraHeaders: Record<string, string> = {};
  if (opts?.ifNoneMatch?.trim()) {
    extraHeaders["If-None-Match"] = opts.ifNoneMatch.trim();
  }

  const res = await fetch(url, {
    method: "GET",
    headers: buildRunnerAuthHeaders(creds, extraHeaders),
  });

  const etagHdr = res.headers.get("etag");
  const etagRaw = etagHdr?.trim() ? etagHdr.trim() : null;

  if (res.status === 304) {
    return { status: 304, etag: etagRaw };
  }

  const text = await res.text();
  if (!res.ok) {
    const snippet =
      text.length > 280 ? `${text.slice(0, 280)}…` : text;
    throw new RunnerGatewayError(`Runner agent-slots failed (${res.status})`, {
      status: res.status,
      bodySnippet: snippet,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new RunnerGatewayError("Runner agent-slots returned non-JSON body", {
      status: res.status,
      bodySnippet: text.slice(0, 280),
    });
  }

  const parsed = runnerAgentSlotsResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RunnerGatewayError("Unexpected runner agent-slots payload shape");
  }

  const payload = parsed.data as IRunnerAgentSlotsResponse;

  return { status: 200, etag: etagRaw, payload };
};
