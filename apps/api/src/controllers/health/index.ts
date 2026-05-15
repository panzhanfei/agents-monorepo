import type { RequestHandler } from "express";
import { livenessPayload } from "@/views/health";

const getHealth: RequestHandler = (_req, res) => {
  res.json(livenessPayload());
};

export const healthController = {
  getHealth,
};
