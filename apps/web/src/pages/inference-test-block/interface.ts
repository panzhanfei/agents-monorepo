import type { IAgentSlotKey } from "@agents/shared-types";

export type IInferenceTestBlockProps = {
  slotKey: IAgentSlotKey;
  /** 表单里当前模型名，便于覆盖探测 */
  modelDraft?: string;
  intro?: string;
};
