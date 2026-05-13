import { fetchJson, getApiBase } from "./client";
import type { IRunnersListResponse, IRunnerRegisterResponse } from "./interface";

export type IRunnerRegisterBody = {
  displayName?: string;
};

export type IRunnerHeartbeatBody = {
  contractVersion?: string;
  mountedProjectIds?: string[];
};

export const fetchRunners = (): Promise<IRunnersListResponse> => fetchJson<IRunnersListResponse>("/runners");

export const registerRunner = (body: IRunnerRegisterBody): Promise<IRunnerRegisterResponse> =>
  fetchJson<IRunnerRegisterResponse>("/runners/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postRunnerHeartbeat = async (
  deviceKey: string,
  deviceSecret: string,
  body: IRunnerHeartbeatBody,
): Promise<void> => {
  const url = `${getApiBase()}/runners/heartbeat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Device-Key": deviceKey,
      "X-Device-Secret": deviceSecret,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "message" in json && typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : `Heartbeat failed (${res.status})`;
    throw new Error(msg);
  }
};
