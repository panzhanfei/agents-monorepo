import express from "express";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { runnersRouter } from "./routes/runners.js";
import { tasksRouter } from "./routes/tasks.js";
import { devRouter } from "./routes/dev.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const createApp = (): express.Express => {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  app.use(healthRouter);
  app.use(runnersRouter);
  app.use(tasksRouter);
  app.use(devRouter);

  app.use(errorHandler);
  return app;
};

export const startServer = (): void => {
  getEnv();
  const app = createApp();
  const { PORT } = getEnv();

  app.listen(PORT, () => {
    console.info(`api listening on http://127.0.0.1:${PORT}`);
  });
};
