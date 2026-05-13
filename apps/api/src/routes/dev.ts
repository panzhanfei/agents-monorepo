import { Router } from "express";
import type { RequestHandler } from "express";
import { getEnv } from "@/config";
import { HttpError, prisma } from "@/lib";

export const devRouter = Router();

const handleDevGate: RequestHandler = (_req, _res, next) => {
  try {
    const env = getEnv();
    const allowed = env.NODE_ENV !== "production" || env.ENABLE_DEV_ROUTES;
    if (!allowed) throw new HttpError(404, "not_found", "Not found");
    next();
  } catch (e) {
    next(e);
  }
};

const handleWhoami: RequestHandler = async (_req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      ok: true,
      userCount,
      note: "Dev-only diagnostics; disable in production unless ENABLE_DEV_ROUTES=true",
    });
  } catch (e) {
    next(e);
  }
};

devRouter.use(handleDevGate);
devRouter.get("/whoami", handleWhoami);
