import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { NextFunction, Request, Response } from "express";

const HEADER_IDS = ["x-request-id", "x-trace-id"];

export const readIncomingTraceId = (req: IncomingMessage): string | undefined => {
  for (const h of HEADER_IDS) {
    const v = req.headers[h];
    const raw = Array.isArray(v) ? v[0] : v;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return undefined;
};

export const traceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = readIncomingTraceId(req);
  const traceId = incoming ?? randomUUID();
  req.traceId = traceId;
  res.setHeader("X-Request-Id", traceId);
  next();
};

export const attachTraceToResponse = (_req: IncomingMessage, res: ServerResponse, traceId: string): void => {
  if (!res.headersSent) {
    res.setHeader("X-Request-Id", traceId);
  }
};
