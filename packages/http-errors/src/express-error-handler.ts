import type { ErrorRequestHandler } from 'express';
import type { ILogger } from '@agents/logger';
import { AppError } from './app-error.js';

export type IErrorHandlerOptions = {
  logger: ILogger;
};

export const createExpressErrorHandler = (
  opts: IErrorHandlerOptions
): ErrorRequestHandler => {
  const { logger } = opts;
  return (err, req, res, _next) => {
    void _next;
    const requestPath = req.path;
    if (err instanceof AppError) {
      logger.warn('request_failed', {
        code: err.code,
        statusCode: err.statusCode,
        path: requestPath,
      });
      res.status(err.statusCode).json({
        ok: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    if (err instanceof Error) {
      logger.error('unhandled_error', {
        name: err.name,
        path: requestPath,
      });
      res.status(500).json({
        ok: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
      return;
    }
    logger.error('unknown_error', { path: requestPath });
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  };
};
