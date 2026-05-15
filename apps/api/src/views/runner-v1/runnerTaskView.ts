import type { Task } from "@prisma/client";

const skillSchemaVersion = "0-placeholder" as const;

export const runnerClaimEmptyPayload = () => ({
  task: null,
  skillSchemaVersion,
});

export const runnerClaimTaskPayload = (claimed: Task) => ({
  task: {
    taskId: claimed.id,
    projectId: claimed.projectId,
    runnerDeviceId: claimed.runnerDeviceId,
    status: claimed.status,
    payload: claimed.payload,
    createdAt: claimed.createdAt.toISOString(),
  },
  skillSchemaVersion,
});

export const runnerTaskMutatePayload = (task: Task) => ({ task });
