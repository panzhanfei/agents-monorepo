import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';

/** 若配置了 token，则要求 `Authorization: Bearer <token>` */
export const optionalInternalBearer =
  (token: string | undefined): RequestHandler =>
  (req, _res, next) => {
    if (token === undefined) {
      next();
      return;
    }
    const auth = req.headers.authorization;
    const expected = `Bearer ${token}`;
    if (auth !== expected) {
      next(new AppError('UNAUTHORIZED', 'Invalid or missing internal bearer token', 401));
      return;
    }
    next();
  };
