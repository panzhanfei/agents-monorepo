import { Router } from "express";
import { runnerV1Controller } from "@/controllers/runner-v1";
import { requireRunner } from "@/middleware";

export const runnerV1Router = Router();

runnerV1Router.use(requireRunner);

runnerV1Router.get("/agent-slots", runnerV1Controller.getAgentSlots);
runnerV1Router.post("/tasks/claim", runnerV1Controller.postClaimTask);
runnerV1Router.patch("/tasks/:taskId/complete", runnerV1Controller.patchComplete);
runnerV1Router.patch("/tasks/:taskId/fail", runnerV1Controller.patchFail);
