import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import { getCodingAgentInternalToken } from '../config/env.js';
import { optionalInternalBearer } from '../middlewares/internal-auth.js';
import { createCodingRunHandler } from '../handlers/coding-run.js';

export type ICodingRunRoutesCtx = {
  logger: ILogger;
  monorepoRoot: string;
};

export const registerCodingRunRoutes = (
  app: Express,
  ctx: ICodingRunRoutesCtx
): void => {
  const token = getCodingAgentInternalToken();
  app.post(
    '/v1/coding/run',
    optionalInternalBearer(token),
    createCodingRunHandler(ctx.logger, ctx.monorepoRoot)
  );
};
