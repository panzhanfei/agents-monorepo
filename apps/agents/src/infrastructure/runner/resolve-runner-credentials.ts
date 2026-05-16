import { z } from "zod";

/** After `normalizeNodeApiBase` */
export interface IResolvedRunnerCredentials {
  readonly apiBaseUrl: string;
  readonly deviceKey: string;
  readonly deviceSecret: string;
}

/** Strip trailing slashes for stable URL joins. */
export const normalizeNodeApiBase = (raw: string): string => raw.trim().replace(/\/+$/, "");

const RunnerCredentialsSchema = z.object({
  RUNNER_NODE_API_BASE: z.string().trim().url(),
  RUNNER_DEVICE_KEY: z.string().trim().min(1),
  RUNNER_DEVICE_SECRET: z.string().min(1),
});

/**
 * Parses control-plane Runner device headers from merged `process.env` (see `loadEnv`).
 * Returns `null` when any piece is missing (local dev without control plane).
 */
export const tryResolveRunnerCredentials = (): IResolvedRunnerCredentials | null => {
  const parsed = RunnerCredentialsSchema.safeParse(process.env);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    apiBaseUrl: normalizeNodeApiBase(d.RUNNER_NODE_API_BASE),
    deviceKey: d.RUNNER_DEVICE_KEY,
    deviceSecret: d.RUNNER_DEVICE_SECRET,
  };
};
