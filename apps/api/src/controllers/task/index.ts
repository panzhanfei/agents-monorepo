import type { RequestHandler } from "express";
import { z } from "zod";
import { requireUserIdOrThrow, pickRouteStringParam } from "@/lib";
import { enqueueTaskForUser, getTaskForUser, listTasksByProjectForUser } from "@/services/task";
import { taskEnqueuePayload, taskOnePayload, tasksListPayload } from "@/views/task";

const enqueueSchema = z.object({
  projectId: z.string().min(1),
  runnerDeviceId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const postEnqueue: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = enqueueSchema.parse(req.body);
    const task = await enqueueTaskForUser({
      userId,
      projectId: body.projectId,
      runnerDeviceId: body.runnerDeviceId,
      payload: body.payload,
      traceId: req.traceId,
    });
    res.status(201).json(taskEnqueuePayload(task));
  } catch (e) {
    next(e);
  }
};

const getByProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const projectId = pickRouteStringParam(req.params.projectId, "projectId");
    const tasks = await listTasksByProjectForUser(userId, projectId);
    res.json(tasksListPayload(tasks));
  } catch (e) {
    next(e);
  }
};

const getOne: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    const task = await getTaskForUser(userId, taskId);
    res.json(taskOnePayload(task));
  } catch (e) {
    next(e);
  }
};

export const tasksController = {
  postEnqueue,
  getByProject,
  getOne,
};
