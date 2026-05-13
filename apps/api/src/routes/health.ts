import { Router } from "express";
import type { RequestHandler } from "express";

export const healthRouter = Router();

const handleHealth: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

healthRouter.get("/health", handleHealth);
