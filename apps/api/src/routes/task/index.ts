import { Router } from "express";
import { tasksController } from "@/controllers/task";
import { requireUser } from "@/middleware";

export const tasksRouter = Router();

tasksRouter.use(requireUser);

tasksRouter.post("/enqueue", tasksController.postEnqueue);
tasksRouter.get("/project/:projectId", tasksController.getByProject);
tasksRouter.get("/:taskId", tasksController.getOne);
