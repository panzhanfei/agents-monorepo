import { getEnv } from "@/config";

export const runnerTtlMs = (): number => getEnv().RUNNER_HEARTBEAT_TTL_SEC * 1000;

export const isRunnerOnlineByLastSeen = (lastSeenAt: Date | null, now: Date = new Date()): boolean => {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() <= runnerTtlMs();
};
