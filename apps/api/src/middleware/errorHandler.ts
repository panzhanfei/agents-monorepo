import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      details: err.flatten(),
    });
    return;
  }

  const message = err instanceof Error ? err.message : "internal_error";
  console.error(err);
  res.status(500).json({ error: "internal_error", message });
};
