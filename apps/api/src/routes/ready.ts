import { Router } from "express";
import type { RequestHandler } from "express";
import { prisma, getRedis } from "@/lib";

export const readyRouter = Router();

const handleReady: RequestHandler = async (_req, res, next) => {
  try {
    const checks: Record<string, "ok" | "error"> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    try {
      const redis = getRedis();
      const pong = await redis.ping();
      checks.redis = pong === "PONG" ? "ok" : "error";
    } catch {
      checks.redis = "error";
    }

    const ok = checks.database === "ok" && checks.redis === "ok";
    res.status(ok ? 200 : 503).json({ ok, checks });
  } catch (e) {
    next(e);
  }
};

readyRouter.get("/ready", handleReady);
