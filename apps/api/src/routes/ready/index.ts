import { Router } from "express";
import { readyController } from "@/controllers/ready";

export const readyRouter = Router();

readyRouter.get("/ready", readyController.getReady);
