import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import type { ITestRunRequest } from '@agents/pipeline-core';
import { z } from 'zod';
import { runFullTestSuite } from '../services/run-test-suite.js';

export const testRunBodySchema = z.object({
  taskId: z.string().min(1),
  workspacePath: z.string().optional(),
  fullTestCommand: z.string().max(16_000).optional(),
  implementationRole: z.enum(['frontend', 'backend', 'fullstack']).optional(),
  stackProfile: z.string().optional(),
});

export const createTestRunHandler = (
  logger: ILogger,
  monorepoRoot: string
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const parsed = testRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new AppError('BAD_REQUEST', detail || 'Invalid body', 400);
      }

      const result = await runFullTestSuite(parsed.data as ITestRunRequest, {
        logger,
        monorepoRoot,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof AppError) {
        next(e);
        return;
      }
      if (e instanceof Error && e.message.includes('工作区不存在')) {
        next(new AppError('BAD_WORKSPACE', e.message, 400));
        return;
      }
      if (
        e instanceof Error &&
        e.message.includes('agents.config.yaml')
      ) {
        next(new AppError('CONFIG_ERROR', e.message, 500));
        return;
      }
      next(e);
    }
  };
};
