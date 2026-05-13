import { Queue } from "bullmq";
import { getEnv } from "@/config";
import { getRedis } from "@/lib";

const QUEUE_NAME = "runner-tasks";

let queue: Queue | null = null;

export const getRunnerTaskQueue = (): Queue => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
    });
  }
  return queue;
};

export const enqueueRunnerTaskJob = async (data: {
  taskId: string;
  traceId?: string;
}): Promise<string | null> => {
  const env = getEnv();
  if (env.RUNNER_TASK_DISPATCH_MODE !== "bullmq") return null;

  const q = getRunnerTaskQueue();
  const job = await q.add(
    "process-runner-task",
    data,
    {
      jobId: data.taskId,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
  return job.id ?? String(job.id);
};
