import type { Response } from "express";

export const writeSsePayload = (
  res: Response,
  event: string,
  payload: Record<string, unknown>,
): void => {
  if (res.writableEnded) return;
  const data = JSON.stringify(payload);
  if (data.length === 0) return;
  res.write(`event: ${event}\ndata: ${data}\n\n`);
};
