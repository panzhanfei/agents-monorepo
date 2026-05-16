import fs from "node:fs";
import path from "node:path";

export type IDeviceCredentials = {
  deviceKey: string;
  deviceSecret: string;
  nodeApiBase: string;
};

export const writeDeviceCredentials = (
  deviceEnvPath: string,
  creds: IDeviceCredentials,
): void => {
  const lines = [
    "# 由 Web「一键绑定」写入，请勿提交或共享。",
    `RUNNER_DEVICE_KEY=${creds.deviceKey}`,
    `RUNNER_DEVICE_SECRET=${creds.deviceSecret}`,
    `RUNNER_NODE_API_BASE=${creds.nodeApiBase.replace(/\/$/, "")}`,
    "",
  ];
  const dir = path.dirname(deviceEnvPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(deviceEnvPath, lines.join("\n"), {
    encoding: "utf8",
    mode: 0o600,
  });
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(deviceEnvPath, 0o600);
    } catch {
      /* ignore */
    }
  }
};
