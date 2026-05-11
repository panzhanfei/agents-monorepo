import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const runnersRouter = Router();

const heartbeatBody = z.object({
  deviceKey: z.string().min(1),
});

runnersRouter.post("/runners/heartbeat", async (req, res, next) => {
  try {
    const body = heartbeatBody.parse(req.body);
    const runner = await prisma.runnerDevice.findUnique({
      where: { deviceKey: body.deviceKey },
    });

    if (!runner) {
      res.status(404).json({ error: "runner_not_found", deviceKey: body.deviceKey });
      return;
    }

    const updated = await prisma.runnerDevice.update({
      where: { id: runner.id },
      data: { lastSeenAt: new Date() },
    });

    res.json({
      ok: true,
      runnerId: updated.id,
      deviceKey: updated.deviceKey,
      lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
    });
  } catch (e) {
    next(e);
  }
});

const registerBody = z.object({
  deviceKey: z.string().min(1),
  userId: z.string().min(1),
});

runnersRouter.post("/runners/register", async (req, res, next) => {
  try {
    const body = registerBody.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const existing = await prisma.runnerDevice.findUnique({
      where: { deviceKey: body.deviceKey },
    });

    if (existing) {
      res.status(409).json({ error: "device_key_taken", runnerId: existing.id });
      return;
    }

    const runner = await prisma.runnerDevice.create({
      data: {
        deviceKey: body.deviceKey,
        userId: body.userId,
        lastSeenAt: new Date(),
      },
    });

    res.status(201).json({
      ok: true,
      runnerId: runner.id,
      deviceKey: runner.deviceKey,
      lastSeenAt: runner.lastSeenAt?.toISOString() ?? null,
    });
  } catch (e) {
    next(e);
  }
});
