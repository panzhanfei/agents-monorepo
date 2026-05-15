import type { RequestHandler } from "express";
import { writeSseEvent } from "@/views/events";

const getStream: RequestHandler = (req, res) => {
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

export const eventsController = {
  getStream,
};
