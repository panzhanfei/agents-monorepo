import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const defaultDeviceEnvPath = (): string =>
  path.join(os.homedir(), ".agents-runner", "device.env");

const parseIntSafe = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
};

const trimOrEmpty = (s: string | undefined): string => (typeof s === "string" ? s.trim() : "");

export type IAgentsConfig = {
  host: string;
  port: number;
  nodeApiBase: string;
  deviceKey: string;
  deviceSecret: string;
  entryChatRoundTokenBudget: number;
  entryChatRouterOverheadTokens: number;
  allowOrigins: string[];
  setupOpenBrowser: boolean;
  setupWebOrigin: string;
  deviceEnvPath: string;
  /** 为 true 时，一键绑定除写入 device.env 外，同步更新本包 `apps/agents/.env` 内 RUNNER_* 三键。 */
  syncCredentialsToLocalDotenv: boolean;
};

const splitOrigins = (raw: string | undefined): string[] => {
  const s = trimOrEmpty(raw);
  if (!s) {
    return ["http://127.0.0.1:5001", "http://localhost:5001"];
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
};

export const readDeviceEnvFile = (deviceEnvPath: string): {
  deviceKey: string;
  deviceSecret: string;
  nodeApiBase: string;
} => {
  if (!fs.existsSync(deviceEnvPath)) {
    return { deviceKey: "", deviceSecret: "", nodeApiBase: "" };
  }
  const vars = new Map<string, string>();
  const text = fs.readFileSync(deviceEnvPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    vars.set(k, v);
  }
  return {
    deviceKey: vars.get("RUNNER_DEVICE_KEY") ?? "",
    deviceSecret: vars.get("RUNNER_DEVICE_SECRET") ?? "",
    nodeApiBase: vars.get("RUNNER_NODE_API_BASE") ?? "",
  };
};

export const buildAgentsConfig = (): IAgentsConfig => {
  const deviceEnvPath =
    trimOrEmpty(process.env.AGENTS_DEVICE_ENV_PATH) || defaultDeviceEnvPath();
  const fromFile = readDeviceEnvFile(deviceEnvPath);
  const nodeApiBase =
    trimOrEmpty(process.env.RUNNER_NODE_API_BASE) ||
    fromFile.nodeApiBase ||
    "http://127.0.0.1:4999";
  return {
    host: trimOrEmpty(process.env.AGENTS_HOST) || trimOrEmpty(process.env.RUNNER_HOST) || "127.0.0.1",
    port: parseIntSafe(process.env.AGENTS_PORT, 3998),
    nodeApiBase: nodeApiBase.replace(/\/$/, ""),
    deviceKey: trimOrEmpty(process.env.RUNNER_DEVICE_KEY) || fromFile.deviceKey,
    deviceSecret: trimOrEmpty(process.env.RUNNER_DEVICE_SECRET) || fromFile.deviceSecret,
    entryChatRoundTokenBudget: parseIntSafe(
      process.env.AGENTS_ENTRY_CHAT_ROUND_TOKEN_BUDGET,
      16_384,
    ),
    entryChatRouterOverheadTokens: parseIntSafe(
      process.env.AGENTS_ENTRY_CHAT_ROUTER_OVERHEAD,
      512,
    ),
    allowOrigins: splitOrigins(process.env.AGENTS_ALLOW_ORIGINS),
    setupOpenBrowser: trimOrEmpty(process.env.AGENTS_SETUP_OPEN_BROWSER) !== "false",
    setupWebOrigin:
      trimOrEmpty(process.env.AGENTS_SETUP_WEB_ORIGIN) || "http://127.0.0.1:5001",
    deviceEnvPath,
    syncCredentialsToLocalDotenv:
      trimOrEmpty(process.env.AGENTS_SYNC_CREDENTIALS_TO_LOCAL_ENV) === "true",
  };
};

export const mergeConfigAfterIngest = (
  prev: IAgentsConfig,
  params: { deviceKey: string; deviceSecret: string; nodeApiBase: string },
): IAgentsConfig => ({
  ...prev,
  deviceKey: params.deviceKey,
  deviceSecret: params.deviceSecret,
  nodeApiBase: params.nodeApiBase.replace(/\/$/, ""),
});
