import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import type { IReviewRunRequest } from '@agents/pipeline-core';
import { z } from 'zod';
import { getLlmEnvConfig } from '../config/env.js';
import { LlmTransportError } from '../clients/llm-openai-compatible.js';
import { runReviewPipeline } from '../services/run-review-pipeline.js';

export const reviewRunBodySchema = z.object({
  taskId: z.string().min(1),
  workspacePath: z.string().optional(),
  implementationRole: z.enum(['frontend', 'backend', 'fullstack']).optional(),
  stackProfile: z.string().optional(),
  changeSummary: z.string().max(80_000).optional(),
  diffText: z.string().max(600_000).optional(),
});

export const createReviewRunHandler = (
  logger: ILogger,
  monorepoRoot: string
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const parsed = reviewRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new AppError('BAD_REQUEST', detail || 'Invalid body', 400);
      }

      const llm = getLlmEnvConfig();
      const result = await runReviewPipeline(
        parsed.data as IReviewRunRequest,
        {
          logger,
          monorepoRoot,
          llm,
        }
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof AppError) {
        next(e);
        return;
      }
      if (e instanceof LlmTransportError) {
        const sc = e.statusCode;
        const status =
          sc !== undefined && sc >= 400 && sc < 600 ? sc : 502;
        next(new AppError('LLM_UPSTREAM', e.message, status));
        return;
      }
      if (e instanceof Error && e.message.includes('工作区不存在')) {
        next(new AppError('BAD_WORKSPACE', e.message, 400));
        return;
      }
      if (
        e instanceof Error &&
        (e.message.includes('agents.config.yaml') ||
          e.message.includes('未知的审核 profile'))
      ) {
        next(new AppError('CONFIG_ERROR', e.message, 500));
        return;
      }
      next(e);
    }
  };
};
