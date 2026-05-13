import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5001,http://127.0.0.1:5001",
    ),
  RUNNER_HEARTBEAT_TTL_SEC: z.coerce.number().int().positive().default(90),
  RUNNER_TASK_LEASE_SEC: z.coerce.number().int().positive().default(180),
  RUNNER_TASK_DISPATCH_MODE: z.enum(["db-only", "bullmq"]).default("db-only"),
  PROCESS_RUNNER_TASKS_IN_WORKER: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  HTTP_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  WORKER_CLOSE_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  ENABLE_DEV_ROUTES: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type IEnv = z.infer<typeof envSchema>;

let cached: IEnv | null = null;

export const getEnv = (): IEnv => {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(detail)}`);
  }
  cached = parsed.data;
  return cached;
};

export const parseAllowedOrigins = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
