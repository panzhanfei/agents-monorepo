import { Router } from "express";
import { healthController } from "@/controllers/health";

export const healthRouter = Router();

healthRouter.get("/health", healthController.getHealth);
