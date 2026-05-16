import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import type { IAgentsSettings } from "@/infrastructure";

import {
  entryChatRequestBodySchema,
  prepareStreamEntryChatContext,
  runPreparedEntryChatStream,
} from "@/application";

import { writeSsePayload } from "../sse/write-sse-payload";

const rejectJsonBeforeSse = (res: Response, status: number, jsonBody: Record<string, unknown>): void => {
  if (res.writableEnded) return;
  res.status(status).json(jsonBody);
};

const beginSseOk = (res: Response): void => {
  if (res.writableEnded) return;
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  type ResponseWithFlush = Response & {
    flushHeaders?: () => void;
  };

  const maybeFlushable = res as ResponseWithFlush;
  if (typeof maybeFlushable.flushHeaders === "function") {
    maybeFlushable.flushHeaders();
  }
};

export const attachAgentEntryChatRoute = (agentRouter: Router, agentsSettings: IAgentsSettings): void => {
  agentRouter.post("/entry/chat", (req: Request, res: Response, next: NextFunction) => {
    void handlePostEntryChat(req, res, next, agentsSettings);
  });
};

const handlePostEntryChat = async (
  req: Request,
  res: Response,
  next: NextFunction,
  agentsSettings: IAgentsSettings,
): Promise<void> => {
  try {
    const parsed = entryChatRequestBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      rejectJsonBeforeSse(res, 400, {
        error: "validation_error",
        details: parsed.error.flatten(),
      });
      return;
    }

    const prepared = await prepareStreamEntryChatContext(parsed.data, agentsSettings);
    if (!prepared.ok) {
      rejectJsonBeforeSse(res, prepared.status, prepared.json);
      return;
    }

    beginSseOk(res);

    const emit = (event: string, payload: Record<string, unknown>): void =>
      writeSsePayload(res, event, payload);

    await runPreparedEntryChatStream(prepared.ctx, emit);

    if (!res.writableEnded) {
      res.end();
    }
  } catch (e) {
    if (res.headersSent || res.writableEnded) {
      if (!res.writableEnded && res.writable) {
        res.end();
      }
      return;
    }
    next(e);
  }
};
