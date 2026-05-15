import { getEnv } from "@/config";
import { prisma } from "@/lib";
import { logger } from "@/middleware";

export type IRunnerTaskJobData = {
  taskId: string;
  traceId?: string;
};

export const processRunnerTaskJob = async (data: IRunnerTaskJobData): Promise<void> => {
  const env = getEnv();
  const log = logger.child({ traceId: data.traceId, taskId: data.taskId });

  if (!data.taskId) {
    log.warn({ msg: "worker_task_missing_id" });
    return;
  }

  if (!env.PROCESS_RUNNER_TASKS_IN_WORKER) {
    log.info({ msg: "worker_skip_runner_task", reason: "PROCESS_RUNNER_TASKS_IN_WORKER=false" });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: data.taskId } });
  if (!task) {
    log.warn({ msg: "worker_task_missing" });
    return;
  }

  if (task.status !== "QUEUED" && task.status !== "PROCESSING") {
    log.info({ msg: "worker_task_skip_status", status: task.status });
    return;
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      lastError: null,
    },
  });

  log.warn({
    msg: "worker_marked_completed",
    note: "Development-only path when PROCESS_RUNNER_TASKS_IN_WORKER=true",
  });
};
