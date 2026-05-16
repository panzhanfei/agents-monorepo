import { z } from "zod";

const commaSeparatedOrigins = z
  .string()
  .optional()
  .transform((raw) =>
    raw === undefined || raw.trim() === ""
      ? undefined
      : raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  );

/** Defaults aligned with `.env.example` comments. */
const DEV_ALLOW_ORIGINS = ["http://127.0.0.1:5001", "http://localhost:5001"] as const;

const AgentsSettingsEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AGENTS_HOST: z.string().trim().min(1).default("127.0.0.1"),
  AGENTS_PORT: z.coerce.number().int().min(1).max(65535).default(3998),
  AGENTS_ALLOW_ORIGINS: commaSeparatedOrigins,
  AGENTS_ENTRY_CHAT_ROUND_TOKEN_BUDGET: z.coerce.number().int().min(256).max(16_777_216).default(16_384),
  AGENTS_ENTRY_CHAT_ROUTER_OVERHEAD: z.coerce.number().int().min(0).max(1_048_576).default(512),
});

export interface IAgentsSettings {
  readonly nodeEnv: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  /** Explicit `AGENTS_ALLOW_ORIGINS=` → []; omit env → dev defaults */
  readonly allowOrigins: readonly string[];
  /** Rough per-turn token budget ceiling for SSE `budget*` events (characters / 4). */
  readonly entryChatRoundTokenBudget: number;
  readonly entryChatRouterOverhead: number;
}

export const loadAgentsSettings = (): IAgentsSettings => {
  const parsed = AgentsSettingsEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.flatten().fieldErrors;
    throw new Error(
      `[agents-settings] Invalid environment: ${JSON.stringify(detail, null, 2)}`,
    );
  }

  const v = parsed.data;
  const allowOrigins =
    v.AGENTS_ALLOW_ORIGINS === undefined ? [...DEV_ALLOW_ORIGINS] : [...v.AGENTS_ALLOW_ORIGINS];

  return {
    nodeEnv: v.NODE_ENV,
    host: v.AGENTS_HOST,
    port: v.AGENTS_PORT,
    allowOrigins,
    entryChatRoundTokenBudget: v.AGENTS_ENTRY_CHAT_ROUND_TOKEN_BUDGET,
    entryChatRouterOverhead: v.AGENTS_ENTRY_CHAT_ROUTER_OVERHEAD,
  };
};
