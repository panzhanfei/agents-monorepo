import type { Task } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { HttpError, isRunnerOnlineByLastSeen } from "@/lib";
import { getEnv } from "@/config";
import { enqueueRunnerTaskJob } from "@/queue";
import {
  findManyTasksByProjectId,
  findProjectRowForUser,
  findRunnerForUser,
  findTaskByUserId,
  insertTask,
  setTaskBullmqJobId,
} from "@/models/task";

export const enqueueTaskForUser = async (params: {
  userId: string;
  projectId: string;
  runnerDeviceId: string;
  payload: Record<string, unknown>;
  traceId: string | undefined;
}): Promise<Task & { bullmqJobId: string | null }> => {
  const project = await findProjectRowForUser(params.userId, params.projectId);
  if (!project) throw new HttpError(404, "not_found", "Project not found");

  const runner = await findRunnerForUser(params.userId, params.runnerDeviceId);
  if (!runner) throw new HttpError(404, "not_found", "Runner not found for user");

  if (!isRunnerOnlineByLastSeen(runner.lastSeenAt)) {
    throw new HttpError(409, "runner_offline", "Runner is offline or has not sent heartbeat");
  }

  const task = await insertTask({
    userId: params.userId,
    projectId: params.projectId,
    runnerDeviceId: params.runnerDeviceId,
    payload: JSON.parse(JSON.stringify(params.payload)) as InputJsonValue,
  });

  const env = getEnv();
  let bullmqJobId: string | null = null;
  if (env.RUNNER_TASK_DISPATCH_MODE === "bullmq") {
    bullmqJobId = await enqueueRunnerTaskJob({
      taskId: task.id,
      traceId: params.traceId,
    });
    if (bullmqJobId) {
      await setTaskBullmqJobId(task.id, bullmqJobId);
    }
  }

  return { ...task, bullmqJobId: bullmqJobId ?? task.bullmqJobId };
};

export const listTasksByProjectForUser = async (
  userId: string,
  projectId: string,
): Promise<Task[]> => {
  const project = await findProjectRowForUser(userId, projectId);
  if (!project) throw new HttpError(404, "not_found", "Project not found");

  return findManyTasksByProjectId(projectId);
};

export const getTaskForUser = async (userId: string, taskId: string): Promise<Task> => {
  const task = await findTaskByUserId(userId, taskId);
  if (!task) throw new HttpError(404, "not_found", "Task not found");
  return task;
};
