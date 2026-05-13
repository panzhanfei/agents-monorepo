import type { Request } from "express";
import { HttpError } from "./httpError";

export const requireUserIdOrThrow = (req: Request): string => {
  const userId = req.authUser?.id;
  if (!userId) throw new HttpError(401, "unauthorized", "Unauthorized");
  return userId;
};

export const pickRouteStringParam = (value: string | string[] | undefined, label: string): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new HttpError(400, "validation_error", `Invalid path parameter: ${label}`);
  }
  return raw;
};
