import { Router } from "express";
import { runnersController } from "@/controllers/runner";
import { requireRunner, requireUser } from "@/middleware";

export const runnersRouter = Router();

runnersRouter.post("/register", requireUser, runnersController.postRegister);
runnersRouter.get("/", requireUser, runnersController.getList);
runnersRouter.post("/heartbeat", requireRunner, runnersController.postHeartbeat);
