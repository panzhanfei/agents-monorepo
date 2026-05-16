import { config as loadDotEnv } from "dotenv";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Load `.env`, device file (`RUNNER_*`), then `.env.local` (override). Cwd expects `apps/agents`. */
export const loadEnv = (): void => {
  const cwd = process.cwd();
  loadDotEnv({ path: resolve(cwd, ".env") });

  const explicit = process.env.AGENTS_DEVICE_ENV_PATH?.trim();
  const fallback = join(homedir(), ".agents-runner", "device.env");
  const devicePath = explicit && explicit.length > 0 ? explicit : fallback;
  if (existsSync(devicePath)) {
    loadDotEnv({ path: devicePath });
  }

  loadDotEnv({ path: resolve(cwd, ".env.local"), override: true });
};
