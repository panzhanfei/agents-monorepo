import type { RequestHandler } from "express";
import { getEnv } from "@/config";
import { HttpError } from "@/lib";
import { countUsers } from "@/services/dev";
import { devWhoamiPayload } from "@/views/dev";

const devGate: RequestHandler = (_req, _res, next) => {
  try {
    const env = getEnv();
    const allowed = env.NODE_ENV !== "production" || env.ENABLE_DEV_ROUTES;
    if (!allowed) throw new HttpError(404, "not_found", "Not found");
    next();
  } catch (e) {
    next(e);
  }
};

const getWhoami: RequestHandler = async (_req, res, next) => {
  try {
    const userCount = await countUsers();
    res.json(devWhoamiPayload(userCount));
  } catch (e) {
    next(e);
  }
};

export const devController = {
  devGate,
  getWhoami,
};
