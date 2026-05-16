import { timingSafeEqual } from "node:crypto";
import type { IAgentsConfig } from "@/infrastructure/config/agents-settings";
import { mergeConfigAfterIngest } from "@/infrastructure/config/agents-settings";
import { writeDeviceCredentials } from "@/infrastructure/persistence/device-env.writer";
import { upsertLocalDotenv } from "@/infrastructure/persistence/local-dotenv.sync";
import type { IStatefulAgentSlotsGateway } from "@/infrastructure/http/node-agent-slots.gateway";

export type IIngestDeviceCredentialsCommand = {
  deviceKey: string;
  deviceSecret: string;
  nodeApiBase: string;
  setupTokenHeader: string;
};

export type IIngestDeviceCredentialsDeps = {
  config: IAgentsConfig;
  setupToken: { getPending(): string | null; clearPending(): void };
  slotsGateway: IStatefulAgentSlotsGateway;
  localDotenvPath: string;
};

export type IIngestResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

const safeEq = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
};

/** 应用服务：校验 setup token，落盘凭据，更新内存配置与网关。 */
export const ingestDeviceCredentials = (
  cmd: IIngestDeviceCredentialsCommand,
  deps: IIngestDeviceCredentialsDeps,
): IIngestResult => {
  const expected = deps.setupToken.getPending();
  if (expected === null || cmd.setupTokenHeader === "") {
    return { ok: false, status: 403, message: "setup not available" };
  }
  if (!safeEq(cmd.setupTokenHeader, expected)) {
    return { ok: false, status: 403, message: "invalid setup token" };
  }

  const base = cmd.nodeApiBase.trim().replace(/\/$/, "");
  if (!base) {
    return { ok: false, status: 400, message: "nodeApiBase required" };
  }

  writeDeviceCredentials(deps.config.deviceEnvPath, {
    deviceKey: cmd.deviceKey,
    deviceSecret: cmd.deviceSecret,
    nodeApiBase: base,
  });

  const next = mergeConfigAfterIngest(deps.config, {
    deviceKey: cmd.deviceKey,
    deviceSecret: cmd.deviceSecret,
    nodeApiBase: base,
  });
  Object.assign(deps.config, next);
  deps.slotsGateway.withCredentials(next.nodeApiBase, next.deviceKey, next.deviceSecret);
  deps.setupToken.clearPending();

  if (deps.config.syncCredentialsToLocalDotenv) {
    upsertLocalDotenv(deps.localDotenvPath, {
      RUNNER_DEVICE_KEY: cmd.deviceKey,
      RUNNER_DEVICE_SECRET: cmd.deviceSecret,
      RUNNER_NODE_API_BASE: base,
    });
  }

  return { ok: true };
};
