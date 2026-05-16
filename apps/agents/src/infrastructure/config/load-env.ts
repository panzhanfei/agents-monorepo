import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

/** 进程启动时加载：`apps/agents/.env` → `AGENTS_DEVICE_ENV_PATH` 或默认 `~/.agents-runner/device.env`。 */
export const loadProcessEnv = (): void => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoEnv = path.resolve(__dirname, "../../../.env");
  if (fs.existsSync(repoEnv)) {
    dotenv.config({ path: repoEnv });
  }
  const devicePath =
    process.env.AGENTS_DEVICE_ENV_PATH?.trim() ||
    path.join(os.homedir(), ".agents-runner", "device.env");
  if (fs.existsSync(devicePath)) {
    dotenv.config({ path: devicePath, override: true });
  }
};
