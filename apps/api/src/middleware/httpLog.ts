import pino from "pino";
import { pinoHttp } from "pino-http";
import type { Request, Response } from "express";

const nodeEnv = process.env.NODE_ENV ?? "development";

export const logger = pino({
  level: nodeEnv === "production" ? "info" : "debug",
  base: {
    service: "api",
    env: nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const redactHeaders = (headers: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...headers };
  if (out.authorization) out.authorization = "[REDACTED]";
  if (out.cookie) out.cookie = "[REDACTED]";
  if (out["x-device-secret"]) out["x-device-secret"] = "[REDACTED]";
  return out;
};

export const httpLogMiddleware = pinoHttp({
  logger,
  genReqId: (req: Request, res: Response) => {
    const id = req.traceId;
    if (id) return id;
    return res.getHeader("X-Request-Id")?.toString() ?? "";
  },
  customProps: (req: Request, res: Response) => {
    const traceId = req.traceId ?? res.getHeader("X-Request-Id")?.toString();
    const props: Record<string, unknown> = {};
    if (traceId) props.traceId = traceId;
    if (req.authUser?.id) props.userId = req.authUser.id;
    return props;
  },
  serializers: {
    req: (req: IncomingMessageLike) => ({
      method: req.method,
      url: req.url?.split("?")[0],
      headers: redactHeaders((req.headers ?? {}) as Record<string, unknown>),
    }),
    res: (res: { statusCode?: number }) => ({
      statusCode: res.statusCode,
    }),
  },
});

type IncomingMessageLike = {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
};
