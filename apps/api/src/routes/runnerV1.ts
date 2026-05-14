import { AGENT_SLOT_KEYS } from "@agents/shared-types";
import type {
  IAgentSlotKey,
  IRunnerAgentSlotSecret,
  IRunnerAgentSlotsResponse,
} from "@agents/shared-types";
import type { UserAgentSlotConfig } from "@prisma/client";
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

const stripEtagQuotes = (raw: string): string => {
  let s = raw.trim();
  if (s.startsWith("W/")) {
    s = s.slice(2).trim();
  }
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s;
};

const parseSlotKeysQuery = (param: unknown): IAgentSlotKey[] => {
  if (param === undefined || param === null) {
    return [...AGENT_SLOT_KEYS];
  }
  let raw: string;
  if (Array.isArray(param)) {
    if (param.length === 0 || typeof param[0] !== "string") {
      throw new HttpError(400, "validation_error", "Invalid keys query");
    }
    raw = param[0];
  } else if (typeof param === "string") {
    raw = param;
  } else {
    throw new HttpError(400, "validation_error", "Invalid keys query");
  }
  if (raw.trim() === "") {
    return [...AGENT_SLOT_KEYS];
  }
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  const invalid = unique.filter((p) => !AGENT_SLOT_KEYS.includes(p as IAgentSlotKey));
  if (invalid.length > 0) {
    throw new HttpError(400, "validation_error", `Invalid keys: ${invalid.join(", ")}`);
  }
  return unique as IAgentSlotKey[];
};

const buildAgentSlotsRevision = (
  keys: IAgentSlotKey[],
  byKey: Map<string, Pick<UserAgentSlotConfig, "updatedAt">>,
): string =>
  [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const row = byKey.get(k);
      return `${k}:${row ? row.updatedAt.toISOString() : "_"}`;
    })
    .join(";");

const rowToRunnerSlotSecret = (row: UserAgentSlotConfig): IRunnerAgentSlotSecret => {
  const mode = row.inferenceMode === "local" ? "local" : "hosted";
  return {
    mode,
    model: row.modelId,
    baseUrl: row.baseUrl ?? null,
    hostedProvider: row.hostedProvider ?? null,
    apiKey: row.apiKey ?? null,
  };
};

const handleAgentSlots: RequestHandler = async (req, res, next) => {
  try {
    const runner = req.authRunner;
    if (!runner) throw new HttpError(401, "unauthorized", "Unauthorized");

    const keys = parseSlotKeysQuery(req.query.keys);
    const rows = await prisma.userAgentSlotConfig.findMany({
      where: { userId: runner.userId, slotKey: { in: keys } },
    });
    const byKey = new Map(rows.map((r) => [r.slotKey, r]));
    const configRevision = buildAgentSlotsRevision(keys, byKey);

    const inmRaw = req.headers["if-none-match"];
    if (typeof inmRaw === "string") {
      const inm = stripEtagQuotes(inmRaw);
      if (inm === configRevision) {
        res.setHeader("ETag", `"${configRevision}"`);
        res.status(304).end();
        return;
      }
    }

    const slots: IRunnerAgentSlotsResponse["slots"] = {};
    for (const k of keys) {
      const row = byKey.get(k);
      slots[k] = row ? rowToRunnerSlotSecret(row) : null;
    }

    const body: IRunnerAgentSlotsResponse = { configRevision, slots };
    res.setHeader("ETag", `"${configRevision}"`);
    res.json(body);
  } catch (e) {
    next(e);
  }
};

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

runnerV1Router.get("/agent-slots", handleAgentSlots);
runnerV1Router.post("/tasks/claim", handleClaim);
runnerV1Router.patch("/tasks/:taskId/complete", handleComplete);
runnerV1Router.patch("/tasks/:taskId/fail", handleFail);
