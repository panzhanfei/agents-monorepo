import "dotenv/config";
import { Worker } from "bullmq";
import { getEnv } from "@/config";
import { getRedis, closeRedis, prisma } from "@/lib";
import { processRunnerTaskJob } from "@/worker/jobs";
import { logger } from "@/middleware";

const QUEUE_NAME = "runner-tasks";

const env = getEnv();

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const traceId = typeof job.data?.traceId === "string" ? job.data.traceId : undefined;
    const log = logger.child({ traceId, jobId: job.id, taskId: job.data?.taskId });
    log.info({ msg: "worker_job_started" });
    await processRunnerTaskJob({
      taskId: String(job.data?.taskId ?? ""),
      traceId,
    });
    log.info({ msg: "worker_job_finished" });
  },
  {
    connection: getRedis(),
  },
);

worker.on("failed", (job, err) => {
  logger.error({
    msg: "worker_job_failed",
    jobId: job?.id,
    taskId: job?.data?.taskId,
    err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
  });
});

logger.info({ msg: "worker_listen", queue: QUEUE_NAME });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ msg: "shutdown_started", signal, process: "worker" });

  try {
    await Promise.race([
      worker.close(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("worker_close_timeout")), env.WORKER_CLOSE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    logger.error({ msg: "worker_close_timeout", timeoutMs: env.WORKER_CLOSE_TIMEOUT_MS });
  }

  await prisma.$disconnect().catch((e: unknown) => {
    logger.error({ msg: "prisma_disconnect_error", err: { message: String(e) } });
  });

  await closeRedis().catch((e: unknown) => {
    logger.error({ msg: "redis_close_error", err: { message: String(e) } });
  });

  logger.info({ msg: "shutdown_complete", signal, process: "worker" });
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
