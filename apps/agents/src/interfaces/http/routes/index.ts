import type { IAgentsSettings } from "@/infrastructure";
import { Router } from "express";

import { attachAgentEntryChatRoute } from "./entry-chat.route";
import { healthRouter } from "./health.route";

export const createHttpRouter = (settings: IAgentsSettings): Router => {
  const r = Router();
  r.use(healthRouter);

  const agentV1Router = Router();
  attachAgentEntryChatRoute(agentV1Router, settings);
  r.use("/v1/agent", agentV1Router);

  return r;
};
