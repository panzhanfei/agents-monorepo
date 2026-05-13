import { Router, type RequestHandler, type Response } from "express";
import { requireUser } from "@/middleware";

export const eventsRouter = Router();

eventsRouter.use(requireUser);

const writeSseEvent = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const handleEventsStream: RequestHandler = (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  writeSseEvent(res, "hello", { ok: true, note: "phase1_placeholder_stream" });
  writeSseEvent(res, "task.progress", {
    taskId: "mock-task",
    percent: 50,
    message: "Synthetic progress event for UI polling alternative tests",
  });

  const interval = setInterval(() => {
    writeSseEvent(res, "task.progress", {
      taskId: "mock-task",
      percent: 100,
      message: "Synthetic tick",
      tick: Date.now(),
    });
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
};

eventsRouter.get("/stream", handleEventsStream);
