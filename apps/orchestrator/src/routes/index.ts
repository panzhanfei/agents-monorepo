import type { Express } from 'express';
import type { ILogger } from '@agents/logger';
import type { ITaskStore } from '@agents/pipeline-core';
import { registerHealthRoutes } from './health.js';
import { registerMockFeishuRoutes } from './mock-feishu.js';
import { registerTaskRoutes } from './tasks.js';
import { SERVICE_LABEL, SERVICE_NAME } from '../config/constants.js';

export type IRoutesContext = {
  logger: ILogger;
  taskStore: ITaskStore;
};

export const registerRoutes = (app: Express, ctx: IRoutesContext): void => {
  registerHealthRoutes(app, {
    logger: ctx.logger,
    agent: SERVICE_NAME,
    label: SERVICE_LABEL,
  });
  registerTaskRoutes(app, { logger: ctx.logger, taskStore: ctx.taskStore });
  registerMockFeishuRoutes(app, {
    logger: ctx.logger,
    taskStore: ctx.taskStore,
  });
};
