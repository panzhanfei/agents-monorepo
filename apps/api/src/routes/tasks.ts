import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { prisma, HttpError, requireUserIdOrThrow, pickRouteStringParam, isRunnerOnlineByLastSeen } from "@/lib";
import { requireUser } from "@/middleware";
import { getEnv } from "@/config";
import { enqueueRunnerTaskJob } from "@/queue";

export const tasksRouter = Router();

tasksRouter.use(requireUser);

const enqueueSchema = z.object({
  projectId: z.string().min(1),
  runnerDeviceId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const handleEnqueue: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = enqueueSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId },
    });
    if (!project) throw new HttpError(404, "not_found", "Project not found");

    const runner = await prisma.runnerDevice.findFirst({
      where: { id: body.runnerDeviceId, userId },
    });
    if (!runner) throw new HttpError(404, "not_found", "Runner not found for user");

    if (!isRunnerOnlineByLastSeen(runner.lastSeenAt)) {
      throw new HttpError(409, "runner_offline", "Runner is offline or has not sent heartbeat");
    }

    const task = await prisma.task.create({
      data: {
        userId,
        projectId: body.projectId,
        runnerDeviceId: body.runnerDeviceId,
        payload: JSON.parse(JSON.stringify(body.payload)) as InputJsonValue,
      },
    });

    const env = getEnv();
    let bullmqJobId: string | null = null;
    if (env.RUNNER_TASK_DISPATCH_MODE === "bullmq") {
      bullmqJobId = await enqueueRunnerTaskJob({
        taskId: task.id,
        traceId: req.traceId,
      });
      if (bullmqJobId) {
        await prisma.task.update({
          where: { id: task.id },
          data: { bullmqJobId },
        });
      }
    }

    res.status(201).json({ task: { ...task, bullmqJobId: bullmqJobId ?? task.bullmqJobId } });
  } catch (e) {
    next(e);
  }
};

const handleListByProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new HttpError(404, "not_found", "Project not found");

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ tasks });
  } catch (e) {
    next(e);
  }
};

const handleGetOne: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) throw new HttpError(404, "not_found", "Task not found");
    res.json({ task });
  } catch (e) {
    next(e);
  }
};

tasksRouter.post("/enqueue", handleEnqueue);
tasksRouter.get("/project/:projectId", handleListByProject);
tasksRouter.get("/:taskId", handleGetOne);
