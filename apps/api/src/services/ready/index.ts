import { probeDatabase, probeRedis } from "@/models/ready";

export const runReadinessChecks = async (): Promise<{
  ok: boolean;
  checks: Record<string, "ok" | "error">;
}> => {
  const checks: Record<string, "ok" | "error"> = {};

  checks.database = (await probeDatabase()) ? "ok" : "error";
  checks.redis = (await probeRedis()) ? "ok" : "error";

  const ok = checks.database === "ok" && checks.redis === "ok";
  return { ok, checks };
};
