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
import { createTaskStore } from './services/task-store/create-task-store.js';

export const createApp = (): express.Express => {
  const logger = createLogger({ service: SERVICE_NAME });
  const taskStore = createTaskStore();
  const app = express();
  app.disable('x-powered-by');
  applySecurityHeaders(app);
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContextPlaceholder);
  registerRoutes(app, { logger, taskStore });
  app.use(notFoundHandler);
  app.use(createExpressErrorHandler({ logger }));
  return app;
};
