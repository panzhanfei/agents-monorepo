import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import { registerHealthRoutes } from './health.js';
import { registerReviewRunRoutes } from './review-run.js';
import { SERVICE_LABEL, SERVICE_NAME } from '../config/constants.js';

export type IRoutesContext = {
  logger: ILogger;
  monorepoRoot: string;
};

export const registerRoutes = (app: Express, ctx: IRoutesContext): void => {
  registerHealthRoutes(app, {
    logger: ctx.logger,
    agent: SERVICE_NAME,
    label: SERVICE_LABEL,
  });
  registerReviewRunRoutes(app, {
    logger: ctx.logger,
    monorepoRoot: ctx.monorepoRoot,
  });
};
