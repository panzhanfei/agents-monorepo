import { AGENT_SLOT_KEYS } from "@agents/shared-types";
import type { IAgentSlotKey } from "@agents/shared-types";
import type { Task } from "@prisma/client";
import { HttpError } from "@/lib";
import { getEnv } from "@/config";
import {
  claimNextQueuedTaskTransaction,
  findAgentSlotConfigsForUserKeys,
  findTaskByRunnerDevice,
  updateTaskCompleted,
  updateTaskFailed,
} from "@/models/runner-v1";

export const parseAgentSlotKeysQuery = (param: unknown): IAgentSlotKey[] => {
  if (param === undefined || param === null) {
    return [...AGENT_SLOT_KEYS];
  }
  let raw: string;
  if (Array.isArray(param)) {
    if (param.length === 0 || typeof param[0] !== "string") {
      throw new HttpError(400, "validation_error", "Invalid keys query");
    }
    raw = param[0];
  } else if (typeof param === "string") {
    raw = param;
  } else {
    throw new HttpError(400, "validation_error", "Invalid keys query");
  }
  if (raw.trim() === "") {
    return [...AGENT_SLOT_KEYS];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  const invalid = unique.filter((p) => !AGENT_SLOT_KEYS.includes(p as IAgentSlotKey));
  if (invalid.length > 0) {
    throw new HttpError(400, "validation_error", `Invalid keys: ${invalid.join(", ")}`);
  }
  return unique as IAgentSlotKey[];
};

export const getAgentSlotsRows = (userId: string, keys: IAgentSlotKey[]) =>
  findAgentSlotConfigsForUserKeys(userId, keys);

export const claimNextQueuedTaskForRunner = async (runnerId: string): Promise<Task | null> => {
  const env = getEnv();
  const leaseMs = env.RUNNER_TASK_LEASE_SEC * 1000;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const outcome = await claimNextQueuedTaskTransaction({ runnerId, leaseExpiresAt, now });

  if (outcome.type === "invalid_runner") {
    throw new HttpError(401, "invalid_runner", "Unknown device");
  }
  if (outcome.type === "offline") {
    throw new HttpError(409, "runner_offline", "Runner heartbeat expired");
  }
  if (outcome.type === "empty") {
    return null;
  }
  return outcome.task;
};

export const completeProcessingTaskForRunner = async (
  runnerId: string,
  taskId: string,
): Promise<Task> => {
  const task = await findTaskByRunnerDevice(runnerId, taskId);
  if (!task) throw new HttpError(404, "not_found", "Task not found");
  if (task.status !== "PROCESSING") {
    throw new HttpError(409, "invalid_state", `Task is not processing (was ${task.status})`);
  }

  return updateTaskCompleted(task.id);
};

export const failProcessingTaskForRunner = async (
  runnerId: string,
  taskId: string,
  errorSummary: string | undefined,
): Promise<Task> => {
  const task = await findTaskByRunnerDevice(runnerId, taskId);
  if (!task) throw new HttpError(404, "not_found", "Task not found");
  if (task.status !== "PROCESSING") {
    throw new HttpError(409, "invalid_state", `Task is not processing (was ${task.status})`);
  }

  return updateTaskFailed(task.id, errorSummary ?? "failed");
};
