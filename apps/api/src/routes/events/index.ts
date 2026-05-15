import { Router } from "express";
import { eventsController } from "@/controllers/events";
import { requireUser } from "@/middleware";

export const eventsRouter = Router();

eventsRouter.use(requireUser);

eventsRouter.get("/stream", eventsController.getStream);
