import { z } from "zod";

import type { IResolvedRunnerCredentials } from "./resolve-runner-credentials";

import { buildRunnerAuthHeaders } from "./build-runner-auth-headers";
import { RunnerGatewayError } from "./runner-gateway.error";

const heartbeatOkSchema = z.object({
  ok: z.literal(true),
  lastSeenAt: z.string(),
});

/** `POST /runners/heartbeat` — same headers as `requireRunner` (`apps/api`). */
export interface IRunnerHeartbeatResult {
  readonly lastSeenAt: string;
}

export const postRunnerHeartbeat = async (
  creds: IResolvedRunnerCredentials,
): Promise<IRunnerHeartbeatResult> => {
  const url = `${creds.apiBaseUrl}/runners/heartbeat`;
  const res = await fetch(url, {
    method: "POST",
    headers: buildRunnerAuthHeaders(creds, { "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });

  const text = await res.text();
  if (!res.ok) {
    const snippet =
      text.length > 280 ? `${text.slice(0, 280)}…` : text;
    throw new RunnerGatewayError(`Runner heartbeat failed (${res.status})`, {
      status: res.status,
      bodySnippet: snippet,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new RunnerGatewayError("Runner heartbeat returned non-JSON body", {
      status: res.status,
      bodySnippet: text.slice(0, 280),
    });
  }

  const parsed = heartbeatOkSchema.safeParse(body);
  if (!parsed.success) {
    throw new RunnerGatewayError("Unexpected runner heartbeat payload shape");
  }

  return { lastSeenAt: parsed.data.lastSeenAt };
};
