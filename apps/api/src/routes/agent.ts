import { Router } from "express";
import type { RequestHandler } from "express";
import { requireUser } from "@/middleware";

export const agentRouter = Router();

agentRouter.use(requireUser);

const handlePreview: RequestHandler = (_req, res) => {
  res.json({
    stepKind: "mock.plan",
    mockOutput: {
      message: "Phase 1 stub: replace with real agent routing in phase 2",
      suggestions: ["enqueue a task", "claim from runner"],
    },
  });
};

agentRouter.get("/preview", handlePreview);
