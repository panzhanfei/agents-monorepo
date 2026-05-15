import { Router } from "express";
import { devController } from "@/controllers/dev";

export const devRouter = Router();

devRouter.use(devController.devGate);
devRouter.get("/whoami", devController.getWhoami);
