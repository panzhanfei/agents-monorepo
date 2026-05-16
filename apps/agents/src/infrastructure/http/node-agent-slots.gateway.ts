import type { IAgentSlotKey, IRunnerAgentSlotsResponse } from "@agents/shared-types";
import {
  AgentSlotsAccessError,
  type IAgentSlotFetchResult,
  type IAgentSlotsGateway,
} from "@/domain";

export type IStatefulAgentSlotsGateway = IAgentSlotsGateway & {
  withCredentials(baseUrl: string, deviceKey: string, deviceSecret: string): void;
};

export const createNodeAgentSlotsGateway = (
  baseUrl: string,
  deviceKey: string,
  deviceSecret: string,
): IStatefulAgentSlotsGateway => {
  const state = { baseUrl: baseUrl.replace(/\/$/, ""), deviceKey, deviceSecret };

  const fetchSlotSecret = async (slotKey: string): Promise<IAgentSlotFetchResult> => {
    const url = new URL("/v1/runner/agent-slots", state.baseUrl);
    url.searchParams.set("keys", slotKey);
    const resp = await fetch(url, {
      headers: {
        "X-Device-Key": state.deviceKey,
        "X-Device-Secret": state.deviceSecret,
        Accept: "application/json",
      },
    });
    if (resp.status === 304) {
      return { kind: "not_modified" };
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new AgentSlotsAccessError(
        text.length > 0 ? text.slice(0, 500) : `agent-slots HTTP ${resp.status}`,
        resp.status,
      );
    }
    const body = (await resp.json()) as IRunnerAgentSlotsResponse;
    return { kind: "slot", value: body.slots[slotKey as IAgentSlotKey] ?? null };
  };

  return {
    fetchSlotSecret,
    withCredentials(baseUrl: string, deviceKey: string, deviceSecret: string): void {
      state.baseUrl = baseUrl.replace(/\/$/, "");
      state.deviceKey = deviceKey;
      state.deviceSecret = deviceSecret;
    },
  };
};
