import type { RequestHandler } from "express";
import { agentPreviewPayload } from "@/views/agent";

const getPreview: RequestHandler = (_req, res) => {
  res.json(agentPreviewPayload());
};

export const agentController = {
  getPreview,
};
