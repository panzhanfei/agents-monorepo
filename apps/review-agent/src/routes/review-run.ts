import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import { getReviewAgentInternalToken } from '../config/env.js';
import { optionalInternalBearer } from '../middlewares/internal-auth.js';
import { createReviewRunHandler } from '../handlers/review-run.js';

export type IReviewRunRoutesCtx = {
  logger: ILogger;
  monorepoRoot: string;
};

export const registerReviewRunRoutes = (
  app: Express,
  ctx: IReviewRunRoutesCtx
): void => {
  const token = getReviewAgentInternalToken();
  app.post(
    '/v1/review/run',
    optionalInternalBearer(token),
    createReviewRunHandler(ctx.logger, ctx.monorepoRoot)
  );
};
