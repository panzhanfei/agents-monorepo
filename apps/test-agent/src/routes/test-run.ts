import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import { getTestAgentInternalToken } from '../config/env.js';
import { optionalInternalBearer } from '../middlewares/internal-auth.js';
import { createTestRunHandler } from '../handlers/test-run.js';

export type ITestRunRoutesCtx = {
  logger: ILogger;
  monorepoRoot: string;
};

export const registerTestRunRoutes = (
  app: Express,
  ctx: ITestRunRoutesCtx
): void => {
  const token = getTestAgentInternalToken();
  app.post(
    '/v1/test/run',
    optionalInternalBearer(token),
    createTestRunHandler(ctx.logger, ctx.monorepoRoot)
  );
};
