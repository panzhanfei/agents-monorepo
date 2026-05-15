import type { IAgentSlotKey } from "@agents/shared-types";
import type { Task } from "@prisma/client";
import { prisma, isRunnerOnlineByLastSeen } from "@/lib";

export const findAgentSlotConfigsForUserKeys = (userId: string, keys: IAgentSlotKey[]) =>
  prisma.userAgentSlotConfig.findMany({
    where: { userId, slotKey: { in: keys } },
  });

export type IClaimNextTaskTxResult =
  | { type: "claimed"; task: Task }
  | { type: "empty" }
  | { type: "invalid_runner" }
  | { type: "offline" };

export const claimNextQueuedTaskTransaction = async (params: {
  runnerId: string;
  leaseExpiresAt: Date;
  now: Date;
}): Promise<IClaimNextTaskTxResult> => {
  const outcome = await prisma.$transaction(async (tx) => {
    const fresh = await tx.runnerDevice.findUnique({ where: { id: params.runnerId } });
    if (!fresh) return { type: "invalid_runner" as const };
    if (!isRunnerOnlineByLastSeen(fresh.lastSeenAt, params.now)) {
      return { type: "offline" as const };
    }

    const nextTask = await tx.task.findFirst({
      where: {
        runnerDeviceId: params.runnerId,
        status: "QUEUED",
      },
      orderBy: { createdAt: "asc" },
    });

    if (!nextTask) return { type: "empty" as const };

    const updated = await tx.task.updateMany({
      where: { id: nextTask.id, status: "QUEUED" },
      data: {
        status: "PROCESSING",
        claimedAt: params.now,
        leaseExpiresAt: params.leaseExpiresAt,
        lastError: null,
      },
    });

    if (updated.count !== 1) return { type: "empty" as const };

    const row = await tx.task.findUnique({ where: { id: nextTask.id } });
    if (!row) return { type: "empty" as const };

    return { type: "claimed" as const, task: row };
  });

  return outcome;
};

export const findTaskByRunnerDevice = (
  runnerDeviceId: string,
  taskId: string,
): Promise<Task | null> =>
  prisma.task.findFirst({
    where: { id: taskId, runnerDeviceId },
  });

export const updateTaskCompleted = (taskId: string): Promise<Task> =>
  prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      lastError: null,
      leaseExpiresAt: null,
    },
  });

export const updateTaskFailed = (taskId: string, lastError: string): Promise<Task> =>
  prisma.task.update({
    where: { id: taskId },
    data: {
      status: "FAILED",
      lastError,
      leaseExpiresAt: null,
    },
  });
