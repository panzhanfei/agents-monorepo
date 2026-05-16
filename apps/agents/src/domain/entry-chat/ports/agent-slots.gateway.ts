import type { IRunnerAgentSlotSecret } from "@agents/shared-types";

/** 应用层读控制面槽位：基础设施可实现为 HTTP Runner API。 */
export type IAgentSlotFetchResult =
  | { kind: "slot"; value: IRunnerAgentSlotSecret | null }
  | { kind: "not_modified" };

export interface IAgentSlotsGateway {
  fetchSlotSecret(slotKey: string): Promise<IAgentSlotFetchResult>;
}
