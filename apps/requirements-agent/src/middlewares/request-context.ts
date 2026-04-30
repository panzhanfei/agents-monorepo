import type { RequestHandler } from 'express';

/** Reserved: attach taskId / correlation IDs from `x-task-id` or body. */
export const requestContextPlaceholder: RequestHandler = (_req, _res, next) => {
  next();
};
