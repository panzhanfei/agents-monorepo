import type { Express } from 'express';
import { PIPELINE_CORE_SCAFFOLD } from '@agents/pipeline-core';
import type { ILogger } from '@agents/logger';

export type IHealthRouteDeps = {
  logger: ILogger;
  agent: string;
  label?: string;
};

export const registerHealthRoutes = (
  app: Express,
  deps: IHealthRouteDeps
): void => {
  app.get('/health', (_req, res) => {
    deps.logger.info('health_check');
    const body: Record<string, unknown> = {
      ok: true,
      agent: deps.agent,
      pipelineCore: PIPELINE_CORE_SCAFFOLD,
    };
    if (deps.label !== undefined) {
      body.label = deps.label;
    }
    res.json(body);
  });
};
