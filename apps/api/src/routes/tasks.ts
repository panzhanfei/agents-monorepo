import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { enqueueAgentTask } from "../queue/agentQueue.js";
import { TaskStatus } from "@prisma/client";

export const tasksRouter = Router();

const enqueueBody = z.object({
  projectId: z.string().min(1),
  runnerDeviceKey: z.string().min(1),
  payload: z.any().optional(),
});

tasksRouter.post("/tasks/enqueue", async (req, res, next) => {
  try {
    const body = enqueueBody.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
    });

    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }

    const runner = await prisma.runnerDevice.findUnique({
      where: { deviceKey: body.runnerDeviceKey },
    });

    if (!runner) {
      res.status(404).json({ error: "runner_not_found" });
      return;
    }

    if (runner.userId !== project.userId) {
      res.status(403).json({ error: "runner_project_user_mismatch" });
      return;
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        runnerDeviceId: runner.id,
        status: TaskStatus.PENDING,
        payload: body.payload as Prisma.InputJsonValue | undefined,
      },
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.QUEUED },
    });

    const bullmqJobId = await enqueueAgentTask({
      taskId: task.taskId,
      projectId: project.id,
      runnerDeviceKey: runner.deviceKey,
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { bullmqJobId },
    });

    res.status(201).json({
      ok: true,
      taskId: task.taskId,
      internalId: task.id,
      bullmqJobId,
      status: TaskStatus.QUEUED,
    });
  } catch (e) {
    next(e);
  }
});

tasksRouter.get("/tasks/:taskId", async (req, res, next) => {
  try {
    const taskId = z.string().uuid().parse(req.params.taskId);

    const task = await prisma.task.findUnique({
      where: { taskId },
      include: { project: true, runnerDevice: true },
    });

    if (!task) {
      res.status(404).json({ error: "task_not_found" });
      return;
    }

    res.json({
      taskId: task.taskId,
      status: task.status,
      projectId: task.projectId,
      runnerDeviceKey: task.runnerDevice.deviceKey,
      bullmqJobId: task.bullmqJobId,
      lastError: task.lastError,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});
