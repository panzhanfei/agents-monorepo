import { Router } from "express";
import { agentController } from "@/controllers/agent";
import { requireUser } from "@/middleware";

export const agentRouter = Router();

agentRouter.use(requireUser);

agentRouter.get("/preview", agentController.getPreview);
