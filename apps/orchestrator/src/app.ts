import express from 'express';
import { createLogger } from '@agents/logger';
import {
  applySecurityHeaders,
  createExpressErrorHandler,
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
  app.use((req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }
    const p = req.path.toLowerCase();
    if (p.includes('feishu') || p.includes('mock-feishu')) {
      logger.info('feishu_http_probe', {
        path: req.path,
        originalUrl: req.originalUrl,
        contentType: req.headers['content-type'] ?? null,
        contentLength: req.headers['content-length'] ?? null,
      });
    }
    next();
  });
  registerRoutes(app, { logger, taskStore });
  app.use((req, res) => {
    logger.warn('http_not_found', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
    });
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  });
  app.use(createExpressErrorHandler({ logger }));
  return app;
};
