import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";

export const AGENT_TASKS_QUEUE = "agent-tasks";

let agentQueue: Queue | null = null;

export const getAgentTaskQueue = (): Queue => {
  if (!agentQueue) {
    agentQueue = new Queue(AGENT_TASKS_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return agentQueue;
};

export type AgentJobPayload = {
  taskId: string;
  projectId: string;
  runnerDeviceKey: string;
};

export const enqueueAgentTask = async (payload: AgentJobPayload): Promise<string> => {
  const queue = getAgentTaskQueue();
  const job = await queue.add("noop", payload, { jobId: payload.taskId });
  return String(job.id);
};
