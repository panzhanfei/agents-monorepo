import type { RequestHandler } from "express";
import { runReadinessChecks } from "@/services/ready";
import { toReadyPayload } from "@/views/ready";

const getReady: RequestHandler = async (_req, res, next) => {
  try {
    const { ok, checks } = await runReadinessChecks();
    res.status(ok ? 200 : 503).json(toReadyPayload(ok, checks));
  } catch (e) {
    next(e);
  }
};

export const readyController = {
  getReady,
};
