import type { RequestHandler } from "express";
import { z } from "zod";
import { HttpError, requireUserIdOrThrow } from "@/lib";
import {
  listRunnerDevicesForUser,
  registerRunnerForUser,
  touchRunnerHeartbeat,
} from "@/services/runner";
import { heartbeatPayload, runnerRegisterPayload, runnersListPayload } from "@/views/runner";

const registerSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
});

const heartbeatSchema = z.object({
  contractVersion: z.string().max(64).optional(),
  mountedProjectIds: z.array(z.string().min(1)).max(50).optional(),
});

const postRegister: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = registerSchema.parse(req.body ?? {});
    const { runner, deviceSecretPlain } = await registerRunnerForUser(userId, body.displayName);
    res.status(201).json(runnerRegisterPayload({ runner, deviceSecretPlain }));
  } catch (e) {
    next(e);
  }
};

const getList: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const runners = await listRunnerDevicesForUser(userId);
    res.json(runnersListPayload(runners));
  } catch (e) {
    next(e);
  }
};

const postHeartbeat: RequestHandler = async (req, res, next) => {
  try {
    const runnerId = req.authRunner?.id;
    if (!runnerId) throw new HttpError(401, "unauthorized", "Unauthorized");
    heartbeatSchema.parse(req.body ?? {});
    const lastSeenAt = await touchRunnerHeartbeat(runnerId);
    res.json(heartbeatPayload(lastSeenAt.toISOString()));
  } catch (e) {
    next(e);
  }
};

export const runnersController = {
  postRegister,
  getList,
  postHeartbeat,
};
