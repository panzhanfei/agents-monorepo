import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import { getRequirementsAgentInternalToken } from '../config/env.js';
import { optionalInternalBearer } from '../middlewares/internal-auth.js';
import { createRequirementsAnalyzeHandler } from '../handlers/requirements-analyze.js';

export type IRequirementsRoutesCtx = {
  logger: ILogger;
};

export const registerRequirementsAnalyzeRoutes = (
  app: Express,
  ctx: IRequirementsRoutesCtx
): void => {
  const token = getRequirementsAgentInternalToken();
  app.post(
    '/v1/requirements/analyze',
    optionalInternalBearer(token),
    createRequirementsAnalyzeHandler(ctx.logger)
  );
};
