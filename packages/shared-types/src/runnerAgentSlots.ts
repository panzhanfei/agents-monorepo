import type { IAgentInferenceMode, IAgentSlotKey } from "./auth";

export type IRunnerAgentSlotSecret = {
  mode: IAgentInferenceMode;
  model: string;
  baseUrl: string | null;
  hostedProvider: string | null;
  /** 未配置 hosted 密钥时为 null */
  apiKey: string | null;
};

/**
 * Runner 拉取控制面槽位配置：含密钥，仅 `requireRunner` 路由返回。
 * `configRevision` 仅由**本次请求 `keys` 集合**对应的槽位状态导出（新增/修改/删除该集合内任一条均会变）。
 * `slots`：未传 `keys` 时包含全部槽位键；传了 `keys` 时仅含所请求的键。
 */
export type IRunnerAgentSlotsResponse = {
  configRevision: string;
  slots: Partial<Record<IAgentSlotKey, IRunnerAgentSlotSecret | null>>;
};
