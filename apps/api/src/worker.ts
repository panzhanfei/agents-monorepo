import { Worker } from "bullmq";
import { getEnv } from "./config/env.js";
import { getRedis } from "./lib/redis.js";
import { AGENT_TASKS_QUEUE, type AgentJobPayload } from "./queue/agentQueue.js";
import { markTaskFailed, processAgentJob } from "./jobs/processAgentTask.js";

getEnv();

const worker = new Worker<AgentJobPayload>(
  AGENT_TASKS_QUEUE,
  async (job) => {
    await processAgentJob(job.data);
  },
  {
    connection: getRedis(),
    concurrency: 5,
  },
);

worker.on("failed", async (job, err) => {
  if (!job?.data?.taskId) return;
  await markTaskFailed(job.data.taskId, err instanceof Error ? err.message : String(err));
});

worker.on("completed", (job) => {
  console.info("job completed", job.id, job.data?.taskId);
});

worker.on("error", (err) => {
  console.error("worker error", err);
});

console.info(`bullmq worker listening on queue "${AGENT_TASKS_QUEUE}"`);
