import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "@/lib";
import { logger } from "./httpLog";

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const traceId = req.traceId;
  if (err instanceof ZodError) {
    logger.warn({
      traceId,
      msg: "validation_error",
      issues: err.issues,
    });
    res.status(400).json({
      code: "validation_error",
      message: "Invalid request",
      detail: err.flatten(),
      ...(traceId ? { traceId } : {}),
    });
    return;
  }

  if (err instanceof HttpError) {
    logger.error({
      traceId,
      err: { name: err.name, message: err.message },
      msg: "http_error",
      statusCode: err.statusCode,
      code: err.code,
    });
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
      ...(traceId ? { traceId } : {}),
    });
    return;
  }

  logger.error({
    traceId,
    err:
      err instanceof Error
        ? { name: err.name, message: err.message, stack: process.env.NODE_ENV === "production" ? undefined : err.stack }
        : { message: String(err) },
    msg: "unhandled_error",
  });

  res.status(500).json({
    code: "internal_error",
    message: "Internal Server Error",
    ...(traceId ? { traceId } : {}),
  });
};
