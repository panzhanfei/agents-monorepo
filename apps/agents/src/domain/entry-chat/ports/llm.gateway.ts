import type { IRunnerAgentSlotSecret } from "@agents/shared-types";
import type { IChatLine } from "../chat-message.vo";

export interface IEntryChatLlmGateway {
  decideNextSlot(
    routerSlot: IRunnerAgentSlotSecret,
    messages: IChatLine[],
  ): Promise<{ nextSlot: string; reason: string }>;
  streamDownstreamReply(
    targetSlot: IRunnerAgentSlotSecret,
    logicalRole: string,
    configSlotKey: string,
    messages: IChatLine[],
  ): AsyncIterable<string>;
}
