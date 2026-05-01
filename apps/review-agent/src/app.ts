import express from 'express';
import { createLogger } from '@agents/logger';
import {
  applySecurityHeaders,
  createExpressErrorHandler,
  notFoundHandler,
} from '@agents/http-errors';
import { requestContextPlaceholder } from './middlewares/request-context.js';
import { registerRoutes } from './routes/index.js';
import { SERVICE_NAME } from './config/constants.js';

export type ICreateAppOptions = {
  readonly monorepoRoot: string;
};

export const createApp = (opts: ICreateAppOptions): express.Express => {
  const logger = createLogger({ service: SERVICE_NAME });
  const app = express();
  app.disable('x-powered-by');
  applySecurityHeaders(app);
  app.use(express.json({ limit: '4mb' }));
  app.use(requestContextPlaceholder);
  registerRoutes(app, { logger, monorepoRoot: opts.monorepoRoot });
  app.use(notFoundHandler);
  app.use(createExpressErrorHandler({ logger }));
  return app;
};
