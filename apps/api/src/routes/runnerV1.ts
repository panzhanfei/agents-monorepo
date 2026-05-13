import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma, HttpError, isRunnerOnlineByLastSeen, pickRouteStringParam } from "@/lib";
import { requireRunner } from "@/middleware";
import { getEnv } from "@/config";

export const runnerV1Router = Router();

runnerV1Router.use(requireRunner);

const completeSchema = z.object({
  resultSummary: z.record(z.string(), z.unknown()).optional(),
});

const failSchema = z.object({
  errorSummary: z.string().max(8000).optional(),
});

const handleClaim: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const env = getEnv();
    const leaseMs = env.RUNNER_TASK_LEASE_SEC * 1000;
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);

    const claimed = await prisma.$transaction(async (tx) => {
      const fresh = await tx.runnerDevice.findUnique({ where: { id: runner.id } });
      if (!fresh) throw new HttpError(401, "invalid_runner", "Unknown device");
      if (!isRunnerOnlineByLastSeen(fresh.lastSeenAt, now)) {
        throw new HttpError(409, "runner_offline", "Runner heartbeat expired");
      }

      const nextTask = await tx.task.findFirst({
        where: {
          runnerDeviceId: runner.id,
          status: "QUEUED",
        },
        orderBy: { createdAt: "asc" },
      });

      if (!nextTask) return null;

      const updated = await tx.task.updateMany({
        where: { id: nextTask.id, status: "QUEUED" },
        data: {
          status: "PROCESSING",
          claimedAt: now,
          leaseExpiresAt,
          lastError: null,
        },
      });

      if (updated.count !== 1) return null;

      return tx.task.findUnique({ where: { id: nextTask.id } });
    });

    if (!claimed) {
      res.json({
        task: null,
        skillSchemaVersion: "0-placeholder",
      });
      return;
    }

    res.json({
      task: {
        taskId: claimed.id,
        projectId: claimed.projectId,
        runnerDeviceId: claimed.runnerDeviceId,
        status: claimed.status,
        payload: claimed.payload,
        createdAt: claimed.createdAt.toISOString(),
      },
      skillSchemaVersion: "0-placeholder",
    });
  } catch (e) {
    next(e);
  }
};

const handleComplete: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    completeSchema.parse(req.body ?? {});

    const task = await prisma.task.findFirst({
      where: { id: taskId, runnerDeviceId: runner.id },
    });
    if (!task) throw new HttpError(404, "not_found", "Task not found");
    if (task.status !== "PROCESSING") {
      throw new HttpError(409, "invalid_state", `Task is not processing (was ${task.status})`);
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        lastError: null,
        leaseExpiresAt: null,
      },
    });

    res.json({ task: updated });
  } catch (e) {
    next(e);
  }
};

const handleFail: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    const body = failSchema.parse(req.body ?? {});

    const task = await prisma.task.findFirst({
      where: { id: taskId, runnerDeviceId: runner.id },
    });
    if (!task) throw new HttpError(404, "not_found", "Task not found");
    if (task.status !== "PROCESSING") {
      throw new HttpError(409, "invalid_state", `Task is not processing (was ${task.status})`);
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        lastError: body.errorSummary ?? "failed",
        leaseExpiresAt: null,
      },
    });

    res.json({ task: updated });
  } catch (e) {
    next(e);
  }
};

runnerV1Router.post("/tasks/claim", handleClaim);
runnerV1Router.patch("/tasks/:taskId/complete", handleComplete);
runnerV1Router.patch("/tasks/:taskId/fail", handleFail);
