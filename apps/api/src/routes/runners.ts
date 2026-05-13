import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  prisma,
  HttpError,
  requireUserIdOrThrow,
  generateDeviceKey,
  generateDeviceSecretPlain,
  hashDeviceSecret,
} from "@/lib";
import { requireUser, requireRunner } from "@/middleware";

export const runnersRouter = Router();

const registerSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
});

const heartbeatSchema = z.object({
  contractVersion: z.string().max(64).optional(),
  mountedProjectIds: z.array(z.string().min(1)).max(50).optional(),
});

const handleRegister: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = registerSchema.parse(req.body ?? {});
    const deviceKey = generateDeviceKey();
    const deviceSecretPlain = generateDeviceSecretPlain();
    const secretHash = await hashDeviceSecret(deviceSecretPlain);

    const runner = await prisma.runnerDevice.create({
      data: {
        userId,
        deviceKey,
        secretHash,
        displayName: body.displayName,
      },
    });

    res.status(201).json({
      runner: {
        id: runner.id,
        deviceKey: runner.deviceKey,
        displayName: runner.displayName,
        createdAt: runner.createdAt,
      },
      deviceSecret: deviceSecretPlain,
    });
  } catch (e) {
    next(e);
  }
};

const handleList: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const runners = await prisma.runnerDevice.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        deviceKey: true,
        displayName: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ runners });
  } catch (e) {
    next(e);
  }
};

const handleHeartbeat: RequestHandler = async (req, res, next) => {
  try {
    const runnerId = req.authRunner?.id;
    if (!runnerId) throw new HttpError(401, "unauthorized", "Unauthorized");

    heartbeatSchema.parse(req.body ?? {});

    const now = new Date();
    await prisma.runnerDevice.update({
      where: { id: runnerId },
      data: { lastSeenAt: now },
    });

    res.json({ ok: true, lastSeenAt: now.toISOString() });
  } catch (e) {
    next(e);
  }
};

runnersRouter.post("/register", requireUser, handleRegister);
runnersRouter.get("/", requireUser, handleList);
runnersRouter.post("/heartbeat", requireRunner, handleHeartbeat);
