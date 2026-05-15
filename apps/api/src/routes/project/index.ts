import { Router } from "express";
import { projectsController } from "@/controllers/project";
import { requireUser } from "@/middleware";
import { projectChatRouter } from "@/routes/project-chat";

export const projectsRouter = Router();

projectsRouter.use(requireUser);
projectsRouter.use("/:projectId/chat", projectChatRouter);

projectsRouter.get("/", projectsController.getList);
projectsRouter.post("/", projectsController.postCreate);
projectsRouter.patch("/:projectId", projectsController.patchProject);
projectsRouter.delete("/:projectId", projectsController.deleteProject);
