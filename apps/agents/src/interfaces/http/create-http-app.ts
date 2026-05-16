import cors from "cors";
import express from "express";
import type { IAppRuntime } from "@/interfaces/http/runtime";
import { mountEntryChatRoute } from "@/interfaces/http/routes/entry-chat.route";
import { mountSetupIngestRoute } from "@/interfaces/http/routes/setup-ingest.route";

export const createHttpApplication = (runtime: IAppRuntime): express.Express => {
  const app = express();
  app.use(
    cors({
      origin: runtime.config.allowOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/v1/stream/example", (_req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.write(`data: ${JSON.stringify({ event: "ping", data: "ok" })}\n\n`);
    setTimeout(() => res.end(), 50);
  });

  mountSetupIngestRoute(app, runtime);
  mountEntryChatRoute(app, runtime);

  return app;
};
