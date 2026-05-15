import type { RequestHandler } from "express";
import { z } from "zod";
import { HttpError, pickRouteStringParam } from "@/lib";
import {
  claimNextQueuedTaskForRunner,
  completeProcessingTaskForRunner,
  failProcessingTaskForRunner,
  getAgentSlotsRows,
  parseAgentSlotKeysQuery,
} from "@/services/runner-v1";
import {
  buildRunnerAgentSlotsResponse,
  runnerClaimEmptyPayload,
  runnerClaimTaskPayload,
  runnerTaskMutatePayload,
  stripEtagQuotes,
} from "@/views/runner-v1";

const completeSchema = z.object({
  resultSummary: z.record(z.string(), z.unknown()).optional(),
});

const failSchema = z.object({
  errorSummary: z.string().max(8000).optional(),
});

const getAgentSlots: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const keys = parseAgentSlotKeysQuery(req.query.keys);
    const rows = await getAgentSlotsRows(runner.userId, keys);
    const body = buildRunnerAgentSlotsResponse(keys, rows);

    const inmRaw = req.headers["if-none-match"];
    if (typeof inmRaw === "string") {
      const inm = stripEtagQuotes(inmRaw);
      if (inm === body.configRevision) {
        res.setHeader("ETag", `"${body.configRevision}"`);
        res.status(304).end();
        return;
      }
    }

    res.setHeader("ETag", `"${body.configRevision}"`);
    res.json(body);
  } catch (e) {
    next(e);
  }
};

const postClaimTask: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const claimed = await claimNextQueuedTaskForRunner(runner.id);

    if (!claimed) {
      res.json(runnerClaimEmptyPayload());
      return;
    }

    res.json(runnerClaimTaskPayload(claimed));
  } catch (e) {
    next(e);
  }
};

const patchComplete: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");
    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    completeSchema.parse(req.body ?? {});
    const updated = await completeProcessingTaskForRunner(runner.id, taskId);
    res.json(runnerTaskMutatePayload(updated));
  } catch (e) {
    next(e);
  }
};

const patchFail: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");
    const taskId = pickRouteStringParam(req.params.taskId, "taskId");
    const body = failSchema.parse(req.body ?? {});
    const updated = await failProcessingTaskForRunner(runner.id, taskId, body.errorSummary);
    res.json(runnerTaskMutatePayload(updated));
  } catch (e) {
    next(e);
  }
};

export const runnerV1Controller = {
  getAgentSlots,
  postClaimTask,
  patchComplete,
  patchFail,
};
