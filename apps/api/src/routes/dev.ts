import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const DEV_EMAIL = "dev@local.test";

export const devRouter = Router();

devRouter.get("/dev/placeholders", async (_req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: DEV_EMAIL },
      include: { projects: true, runners: true },
    });

    if (!user) {
      res.status(404).json({
        error: "seed_not_run",
        hint: "pnpm --filter api db:seed",
      });
      return;
    }

    res.json({
      userId: user.id,
      email: user.email,
      projectId: user.projects[0]?.id ?? null,
      projectName: user.projects[0]?.name ?? null,
      runnerDeviceKey: user.runners[0]?.deviceKey ?? null,
      runnerId: user.runners[0]?.id ?? null,
      sample: {
        heartbeat: { deviceKey: user.runners[0]?.deviceKey },
        enqueue: {
          projectId: user.projects[0]?.id,
          runnerDeviceKey: user.runners[0]?.deviceKey,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});
