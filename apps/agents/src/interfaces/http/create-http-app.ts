import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { IAgentsSettings } from "@/infrastructure";

import { createHttpRouter } from "./routes/index";

export const createHttpApp = (settings: IAgentsSettings): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "512kb" }));
  app.use(
    cors({
      credentials: true,
      origin: (origin, cb) => {
        if (!origin) {
          cb(null, true);
          return;
        }
        if (settings.allowOrigins.some((allowed) => allowed === origin)) {
          cb(null, true);
          return;
        }
        cb(null, false);
      },
    }),
  );

  app.use(createHttpRouter(settings));

  return app;
};
