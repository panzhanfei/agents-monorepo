import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { Server } from "http";
import { getEnv, parseAllowedOrigins } from "@/config";
import { traceMiddleware, httpLogMiddleware, errorHandler, logger } from "@/middleware";
import {
  agentRouter,
  authRouter,
  devRouter,
  eventsRouter,
  healthRouter,
  projectsRouter,
  readyRouter,
  runnerV1Router,
  runnersRouter,
  tasksRouter,
} from "@/routes";
import { prisma, closeRedis } from "@/lib";

export const createApp = (): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: parseAllowedOrigins(getEnv().ALLOWED_ORIGINS),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "512kb" }));

  app.use(traceMiddleware);
  app.use(httpLogMiddleware);

  app.use(healthRouter);
  app.use(readyRouter);

  app.use("/auth", authRouter);
  app.use("/projects", projectsRouter);
  app.use("/tasks", tasksRouter);
  app.use("/runners", runnersRouter);
  app.use("/v1/runner", runnerV1Router);
  app.use("/dev", devRouter);
  app.use("/v1/agent", agentRouter);
  app.use("/v1/events", eventsRouter);

  app.use(errorHandler);
  return app;
};

export type IShutdownHandles = {
  server: Server;
  timeoutMs: number;
};

export const gracefulShutdown = async (handles: IShutdownHandles, signal: NodeJS.Signals): Promise<void> => {
  const { server, timeoutMs } = handles;
  logger.info({ msg: "shutdown_started", signal });

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.error({ msg: "shutdown_timeout", signal });
      resolve();
    }, timeoutMs);

    server.close((err) => {
      clearTimeout(timer);
      if (err) {
        logger.error({ msg: "server_close_error", err: { message: err.message } });
      }
      resolve();
    });
  });

  await prisma.$disconnect().catch((e: unknown) => {
    logger.error({ msg: "prisma_disconnect_error", err: { message: String(e) } });
  });

  await closeRedis().catch((e: unknown) => {
    logger.error({ msg: "redis_close_error", err: { message: String(e) } });
  });

  logger.info({ msg: "shutdown_complete", signal });
};
